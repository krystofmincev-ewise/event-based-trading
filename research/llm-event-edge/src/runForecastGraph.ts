import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";

import type {
  EventForecast,
  ForecastPacket,
  LockedForecast,
  SectorId,
} from "./domain.js";
import { SECTOR_IDS } from "./domain.js";
import {
  buildMacOsSeatbeltProfile,
  cacheMatchesProvenance,
} from "./forecastExecutionControls.js";
import {
  assertForecastCoverage,
  parseForecastBatch,
} from "./forecastValidation.js";
import {
  DATA_ROOT,
  STUDY_ROOT,
  mapWithConcurrency,
  readJsonLines,
  readStudyConfig,
  sha256,
  writeJson,
  writeJsonLines,
} from "./io.js";

interface ModelJob {
  id: string;
  prompt: string;
  expectedIds: string[];
}

interface ModelJobResult {
  id: string;
  forecasts: EventForecast[];
  stderrHash: string;
  promptHash: string;
  fromCache: boolean;
  nodeGeneratedAt: string;
  cliVersion: string;
  schemaSha256: string;
  isolationPolicy: string;
}

interface NodeProvenance {
  cliVersion: string;
  schemaSha256: string;
  isolationPolicy: string;
}

const runProcess = async (
  command: string,
  arguments_: string[],
  input: string,
  workingDirectory: string,
  timeoutMs = 600_000,
  environmentOverrides: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolveProcess, rejectProcess) => {
    const inheritedEnvironment = [
      "PATH",
      "HOME",
      "CODEX_HOME",
      "TMPDIR",
      "LANG",
      "LC_ALL",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
    ].flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value] as const];
    });
    const child = spawn(command, arguments_, {
      cwd: workingDirectory,
      env: Object.fromEntries([
        ...inheritedEnvironment,
        ["NO_COLOR", "1"],
        ...Object.entries(environmentOverrides),
      ]),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);
    child.on("error", rejectProcess);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        rejectProcess(new Error(`${command} timed out after ${timeoutMs}ms.`));
      } else if (code === 0) resolveProcess({ stdout, stderr });
      else rejectProcess(new Error(`${command} exited ${code}: ${stderr}`));
    });
    child.stdin.end(input);
  });

const findOnPath = async (name: string): Promise<string> => {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = resolve(directory, name);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue searching PATH.
    }
  }
  throw new Error(`${name} was not found on PATH.`);
};

const resolveNativeCodex = async (): Promise<string> => {
  const configured = process.env.CODEX_NATIVE_BINARY;
  if (configured !== undefined) return realpath(configured);
  const launcher = await realpath(await findOnPath("codex"));
  const packageRoot = resolve(dirname(launcher), "..");
  const platform = process.platform;
  const architecture = process.arch;
  const target: readonly [string, string] | null =
    platform === "darwin" && architecture === "arm64"
      ? ["codex-darwin-arm64", "aarch64-apple-darwin"]
      : platform === "darwin" && architecture === "x64"
        ? ["codex-darwin-x64", "x86_64-apple-darwin"]
        : platform === "linux" && architecture === "x64"
          ? ["codex-linux-x64", "x86_64-unknown-linux-musl"]
          : platform === "linux" && architecture === "arm64"
            ? ["codex-linux-arm64", "aarch64-unknown-linux-musl"]
            : null;
  if (target === null) {
    throw new Error(
      `Unsupported Codex isolation platform: ${platform}/${architecture}.`,
    );
  }
  const candidate = resolve(
    packageRoot,
    "node_modules",
    "@openai",
    target[0],
    "vendor",
    target[1],
    "bin",
    platform === "win32" ? "codex.exe" : "codex",
  );
  await access(candidate);
  return realpath(candidate);
};

const codexVersion = async (codexExecutable: string) => {
  const result = await runProcess(
    codexExecutable,
    ["--version"],
    "",
    STUDY_ROOT,
  );
  return result.stdout.trim();
};

const callCodex = async (
  job: ModelJob,
  model: string,
  reasoningEffort: string,
  provenance: NodeProvenance,
  codexExecutable: string,
): Promise<ModelJobResult> => {
  const promptHash = sha256(job.prompt);
  const originalHome = process.env.HOME;
  if (originalHome === undefined) throw new Error("HOME is required.");
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "event-edge-eval-"),
    );
    const isolatedCodexHome = join(temporaryDirectory, ".codex");
    await mkdir(isolatedCodexHome, { recursive: true });
    const sourceCodexHome =
      process.env.CODEX_HOME ?? resolve(originalHome, ".codex");
    await copyFile(
      resolve(sourceCodexHome, "auth.json"),
      resolve(isolatedCodexHome, "auth.json"),
    );
    const sandboxProfile = buildMacOsSeatbeltProfile({
      originalHome,
      temporaryDirectory,
      allowedExecutable: codexExecutable,
    });
    const schemaSource = resolve(STUDY_ROOT, "schemas", "forecast.schema.json");
    const schemaPath = join(temporaryDirectory, basename(schemaSource));
    const outputPath = join(temporaryDirectory, "forecast.json");
    await writeFile(schemaPath, await readFile(schemaSource, "utf8"), "utf8");
    try {
      const result = await runProcess(
        "/usr/bin/sandbox-exec",
        [
          "-p",
          sandboxProfile,
          codexExecutable,
          "exec",
          "--model",
          model,
          "--sandbox",
          "read-only",
          "--ephemeral",
          "--ignore-user-config",
          "--ignore-rules",
          "--skip-git-repo-check",
          "--color",
          "never",
          "-c",
          'web_search="disabled"',
          "-c",
          `model_reasoning_effort="${reasoningEffort}"`,
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
          "-",
        ],
        job.prompt,
        temporaryDirectory,
        600_000,
        {
          HOME: temporaryDirectory,
          CODEX_HOME: isolatedCodexHome,
        },
      );
      const parsed = parseForecastBatch(
        JSON.parse(await readFile(outputPath, "utf8")) as unknown,
      );
      assertForecastCoverage(parsed.forecasts, job.expectedIds);
      return {
        id: job.id,
        forecasts: parsed.forecasts,
        stderrHash: sha256(result.stderr),
        promptHash,
        fromCache: false,
        nodeGeneratedAt: new Date().toISOString(),
        ...provenance,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`${job.id} failed attempt ${attempt}; retrying.`);
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
  throw lastError;
};

const cacheFileName = (jobId: string) =>
  `${jobId.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}.json`;

const callCodexCached = async (
  job: ModelJob,
  model: string,
  reasoningEffort: string,
  cacheRoot: string,
  provenance: NodeProvenance,
  codexExecutable: string,
): Promise<ModelJobResult> => {
  const cachePath = resolve(cacheRoot, cacheFileName(job.id));
  const promptHash = sha256(job.prompt);
  try {
    const value: unknown = JSON.parse(await readFile(cachePath, "utf8"));
    if (
      cacheMatchesProvenance(value, {
        id: job.id,
        model,
        reasoningEffort,
        promptHash,
        provenance,
      })
    ) {
      const cached = value;
      const forecasts = parseForecastBatch({
        forecasts: cached.forecasts,
      }).forecasts;
      assertForecastCoverage(forecasts, job.expectedIds);
      return {
        id: job.id,
        forecasts,
        promptHash,
        stderrHash:
          typeof cached.stderrHash === "string" ? cached.stderrHash : "",
        fromCache: true,
        nodeGeneratedAt: cached.nodeGeneratedAt,
        ...provenance,
      };
    }
  } catch {
    // A missing, stale, or malformed cache entry is safely recomputed.
  }
  const result = await callCodex(
    job,
    model,
    reasoningEffort,
    provenance,
    codexExecutable,
  );
  await writeJson(cachePath, {
    id: result.id,
    model,
    reasoningEffort,
    promptHash: result.promptHash,
    stderrHash: result.stderrHash,
    nodeGeneratedAt: result.nodeGeneratedAt,
    cliVersion: result.cliVersion,
    schemaSha256: result.schemaSha256,
    isolationPolicy: result.isolationPolicy,
    forecasts: result.forecasts,
  });
  return result;
};

const analystPrompt = (
  sectorId: SectorId,
  replicate: number,
  packets: ForecastPacket[],
) => `You are analyst ${replicate + 1} in a sealed financial-forecasting evaluation.

Information policy:
- Use ONLY the JSON packets below. Do not browse, use external tools, rely on remembered facts about these post-cutoff events, or inspect any other files.
- The events occur after the model's documented 2026-02-16 knowledge cutoff. Outcomes, actual EPS, surprise, and post-event prices have been omitted.
- This is a reconstructed retrospective pipeline test, not live advice.

Forecast target:
- probabilityUp1d: raw stock return above 0 from the packet entry close to the next regular-session close.
- probabilityUp10d and probabilityUp40d: raw stock return above 0 at the 10th and 40th subsequent regular-session close.
- absolute thresholds refer to raw absolute terminal return, not one-touch or intraday movement.
- expected returns are decimals (0.03 means +3%).

Method:
- Start from realistic base rates, then update modestly for growth persistence, earnings quality, prior trend, volatility, valuation-relevant operating evidence, and contrary evidence.
- Analyst ${replicate + 1} should ${replicate === 0 ? "emphasize fundamental continuation and balance-sheet quality" : "emphasize expectation risk, mean reversion, crowded narratives, and reasons the market may already price the thesis"}.
- Calibrate probabilities. Do not map prose confidence mechanically to extreme probabilities.
- Set abstain=true only when the packet is materially insufficient, but still return baseline-like probabilities so missing calls cannot improve selective accuracy.
- Return exactly one forecast for every caseId and no others.

Sector lens: ${sectorId}

Packets:
${JSON.stringify(packets)}
`;

const synthesisPrompt = (
  sectorId: SectorId,
  packets: ForecastPacket[],
  first: EventForecast[],
  second: EventForecast[],
) => `You are the synthesis node in a sealed forecasting graph.

Use ONLY the supplied outcome-blinded packets and two independent analyst forecasts. Web search and external data are forbidden. Do not infer or invent event outcomes.

For every caseId:
- Reconcile disagreements using the packet evidence.
- Prefer conservative, well-calibrated probabilities over false precision.
- Do not average blindly when one thesis is contradicted by the packet, but keep adjustments modest.
- An abstention still requires baseline-like probabilities.
- Return exactly one schema-valid forecast per caseId and no others.

Sector: ${sectorId}

Packets:
${JSON.stringify(packets)}

Analyst 1:
${JSON.stringify(first)}

Analyst 2:
${JSON.stringify(second)}
`;

const chunks = <Value>(values: Value[], size: number): Value[][] => {
  const output: Value[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
};

const run = async () => {
  const config = await readStudyConfig();
  const codexExecutable = await resolveNativeCodex();
  const cliVersion = await codexVersion(codexExecutable);
  const schemaSha256 = sha256(
    await readFile(
      resolve(STUDY_ROOT, "schemas", "forecast.schema.json"),
      "utf8",
    ),
  );
  const nodeProvenance: NodeProvenance = {
    cliVersion,
    schemaSha256,
    isolationPolicy: "macos-seatbelt-no-home-no-subprocess-v2",
  };
  const outputRoot = resolve(DATA_ROOT, "forecasts", config.studyId);
  const nodeCacheRoot = resolve(outputRoot, "nodes");
  const packetHashes: Partial<Record<SectorId, string>> = {};
  const packetBatches: Array<{
    sectorId: SectorId;
    batchIndex: number;
    packets: ForecastPacket[];
  }> = [];
  for (const sectorId of SECTOR_IDS) {
    const packetPath = resolve(
      DATA_ROOT,
      "private",
      "packets",
      `${sectorId}.jsonl`,
    );
    const packetBody = await readFile(packetPath, "utf8");
    packetHashes[sectorId] = sha256(packetBody);
    const packets = await readJsonLines<ForecastPacket>(packetPath);
    chunks(packets, config.forecastBatchSize).forEach((batch, batchIndex) => {
      packetBatches.push({ sectorId, batchIndex, packets: batch });
    });
  }

  const analystJobs = packetBatches.flatMap(
    ({ sectorId, batchIndex, packets }) =>
      Array.from({ length: config.analystReplicates }, (_, replicate) => ({
        id: `${sectorId}:${batchIndex}:analyst-${replicate + 1}`,
        prompt: analystPrompt(sectorId, replicate, packets),
        expectedIds: packets.map(({ caseId }) => caseId),
      })),
  );
  console.log(`Running ${analystJobs.length} sealed analyst calls…`);
  const analystResults = await mapWithConcurrency(
    analystJobs,
    config.maximumConcurrentModelCalls,
    async (job, index) => {
      const result = await callCodexCached(
        job,
        config.model,
        config.reasoningEffort,
        nodeCacheRoot,
        nodeProvenance,
        codexExecutable,
      );
      console.log(
        `Analyst call ${index + 1}/${analystJobs.length}: ${job.id}${result.fromCache ? " (cached)" : ""}`,
      );
      return result;
    },
  );
  const analystById = new Map(
    analystResults.map((result) => [result.id, result]),
  );

  const synthesisJobs = packetBatches.map(
    ({ sectorId, batchIndex, packets }) => {
      const first = analystById.get(`${sectorId}:${batchIndex}:analyst-1`);
      const second = analystById.get(`${sectorId}:${batchIndex}:analyst-2`);
      if (first === undefined || second === undefined) {
        throw new Error(
          `Missing analyst result for ${sectorId}:${batchIndex}.`,
        );
      }
      return {
        id: `${sectorId}:${batchIndex}:synthesis`,
        prompt: synthesisPrompt(
          sectorId,
          packets,
          first.forecasts,
          second.forecasts,
        ),
        expectedIds: packets.map(({ caseId }) => caseId),
      };
    },
  );
  console.log(`Running ${synthesisJobs.length} sealed synthesis calls…`);
  const synthesisResults = await mapWithConcurrency(
    synthesisJobs,
    config.maximumConcurrentModelCalls,
    async (job, index) => {
      const result = await callCodexCached(
        job,
        config.model,
        config.reasoningEffort,
        nodeCacheRoot,
        nodeProvenance,
        codexExecutable,
      );
      console.log(
        `Synthesis call ${index + 1}/${synthesisJobs.length}: ${job.id}${result.fromCache ? " (cached)" : ""}`,
      );
      return result;
    },
  );

  const locked: LockedForecast[] = synthesisResults.flatMap((result) => {
    const [sectorId] = result.id.split(":") as [SectorId];
    return result.forecasts.map((forecast) => ({
      ...forecast,
      studyId: config.studyId,
      sectorId,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      graphNode: "synthesis",
      generatedAt: result.nodeGeneratedAt,
      informationPolicy: "packet-only-no-web",
    }));
  });
  const lockedForecastPath = resolve(outputRoot, "locked-forecasts.jsonl");
  await writeJsonLines(lockedForecastPath, locked);
  const lockedForecastsSha256 = sha256(
    await readFile(lockedForecastPath, "utf8"),
  );
  const generatedAt = new Date().toISOString();
  await writeJson(resolve(outputRoot, "run-manifest.json"), {
    studyId: config.studyId,
    generatedAt,
    cliVersion,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    webSearch: "disabled",
    sandbox: "read-only",
    ephemeral: true,
    analystReplicates: config.analystReplicates,
    packetHashes,
    schemaSha256,
    lockedForecastsSha256,
    analystCalls: analystResults.map(
      ({
        id,
        promptHash,
        stderrHash,
        fromCache,
        nodeGeneratedAt,
        isolationPolicy,
      }) => ({
        id,
        promptHash,
        stderrHash,
        fromCache,
        nodeGeneratedAt,
        isolationPolicy,
      }),
    ),
    synthesisCalls: synthesisResults.map(
      ({
        id,
        promptHash,
        stderrHash,
        fromCache,
        nodeGeneratedAt,
        isolationPolicy,
      }) => ({
        id,
        promptHash,
        stderrHash,
        fromCache,
        nodeGeneratedAt,
        isolationPolicy,
      }),
    ),
    forecastCount: locked.length,
    retrospectiveUse: "pipeline-development-only",
  });
  console.log(`Locked ${locked.length} synthesized forecasts.`);
};

await run();
