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
