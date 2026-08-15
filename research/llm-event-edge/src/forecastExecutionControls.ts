interface NodeProvenance {
  cliVersion: string;
  schemaSha256: string;
  isolationPolicy: string;
}

interface CacheExpectation {
  id: string;
  model: string;
  reasoningEffort: string;
  promptHash: string;
  provenance: NodeProvenance;
}

interface CompatibleCache extends Record<string, unknown> {
  nodeGeneratedAt: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const cacheMatchesProvenance = (
  value: unknown,
  expected: CacheExpectation,
): value is CompatibleCache => {
  const cached = asRecord(value);
  return (
    cached !== null &&
    cached.id === expected.id &&
    cached.model === expected.model &&
    cached.reasoningEffort === expected.reasoningEffort &&
    cached.promptHash === expected.promptHash &&
    cached.cliVersion === expected.provenance.cliVersion &&
    cached.schemaSha256 === expected.provenance.schemaSha256 &&
    cached.isolationPolicy === expected.provenance.isolationPolicy &&
    typeof cached.nodeGeneratedAt === "string"
  );
};

const escapeSeatbeltLiteral = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const buildMacOsSeatbeltProfile = ({
  originalHome,
  temporaryDirectory,
  allowedExecutable,
}: {
  originalHome: string;
  temporaryDirectory: string;
  allowedExecutable: string;
}): string => `(version 1)
(allow default)
(deny file-read* file-write* (subpath "${escapeSeatbeltLiteral(originalHome)}"))
(allow file-read* file-write* (subpath "${escapeSeatbeltLiteral(temporaryDirectory)}"))
(deny process-exec)
(allow process-exec (literal "${escapeSeatbeltLiteral(allowedExecutable)}"))`;
