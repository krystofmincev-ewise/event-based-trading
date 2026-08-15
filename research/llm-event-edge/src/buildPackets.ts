import { resolve } from "node:path";

import type { EventCase, ForecastPacket } from "./domain.js";
import { SECTOR_IDS } from "./domain.js";
import { buildForecastPacket } from "./forecastPacket.js";
import { DATA_ROOT, readJsonLines, writeJson, writeJsonLines } from "./io.js";

const run = async () => {
  const cases = await readJsonLines<EventCase>(
    resolve(DATA_ROOT, "private", "cases.jsonl"),
  );
  const counts: Record<string, number> = {};
  for (const sectorId of SECTOR_IDS) {
    const packets: ForecastPacket[] = cases
      .filter((eventCase) => eventCase.sectorIds.includes(sectorId))
      .map((eventCase) => buildForecastPacket(eventCase, sectorId));
    await writeJsonLines(
      resolve(DATA_ROOT, "private", "packets", `${sectorId}.jsonl`),
      packets,
    );
    counts[sectorId] = packets.length;
  }
  await writeJson(resolve(DATA_ROOT, "private", "packets", "manifest.json"), {
    generatedAt: new Date().toISOString(),
    outcomeFieldsPresent: false,
    webSearchAllowedDuringForecast: false,
    counts,
  });
  console.log(
    `Wrote ${Object.values(counts).reduce((sum, value) => sum + value, 0)} sector-case packets.`,
  );
};

await run();
