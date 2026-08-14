const UINT32_RANGE = 4_294_967_296;

export const hashSeed = (seed: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Counter-based deterministic draw in (0, 1), independent of traversal order. */
export const randomAt = (
  seedHash: number,
  pathIndex: number,
  tradeIndex: number,
): number => {
  let value =
    seedHash ^
    Math.imul(pathIndex + 1, 0x9e3779b1) ^
    Math.imul(tradeIndex + 1, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return ((value >>> 0) + 0.5) / UINT32_RANGE;
};

/** Independent deterministic stream for models that need multiple draws per event. */
export const randomStreamAt = (
  seedHash: number,
  pathIndex: number,
  observationIndex: number,
  streamIndex: number,
): number =>
  randomAt(
    seedHash ^ Math.imul(streamIndex + 1, 0x27d4eb2d),
    pathIndex,
    observationIndex,
  );

export const standardNormalAt = (
  seedHash: number,
  pathIndex: number,
  observationIndex: number,
  streamIndex: number,
): number => {
  const first = randomStreamAt(
    seedHash,
    pathIndex,
    observationIndex,
    streamIndex,
  );
  const second = randomStreamAt(
    seedHash,
    pathIndex,
    observationIndex,
    streamIndex + 1,
  );
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
};

export const poissonFromUniform = (mean: number, uniform: number): number => {
  if (mean <= 0) return 0;
  let probability = Math.exp(-mean);
  let cumulative = probability;
  let count = 0;
  while (uniform > cumulative && count < 10_000) {
    count += 1;
    probability *= mean / count;
    cumulative += probability;
  }
  return count;
};
