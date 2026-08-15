interface HashBindingOptions {
  allowMissingExpected?: boolean;
}

export const assertArtifactHash = (
  actualSha256: string,
  expectedSha256: unknown,
  context: string,
  { allowMissingExpected = false }: HashBindingOptions = {},
): void => {
  if (allowMissingExpected && typeof expectedSha256 !== "string") return;
  if (typeof expectedSha256 !== "string" || expectedSha256 !== actualSha256) {
    throw new Error(`${context} does not match its manifest.`);
  }
};

export const assertUniqueValues = (
  values: readonly string[],
  context: string,
): void => {
  if (new Set(values).size !== values.length) {
    throw new Error(`${context} contains duplicate IDs.`);
  }
};

export const assertExactCoverage = (
  actualValues: readonly string[],
  expectedValues: readonly string[],
  context: string,
): void => {
  const actual = new Set(actualValues);
  const expected = new Set(expectedValues);
  if (
    actual.size !== actualValues.length ||
    expected.size !== expectedValues.length ||
    actual.size !== expected.size ||
    [...actual].some((value) => !expected.has(value))
  ) {
    throw new Error(`${context} coverage or uniqueness check failed.`);
  }
};
