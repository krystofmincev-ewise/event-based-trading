export const mean = (values: number[]): number =>
  values.length === 0
    ? Number.NaN
    : values.reduce((sum, value) => sum + value, 0) / values.length;

export const brierScore = (probability: number, outcome: boolean) =>
  (probability - Number(outcome)) ** 2;

export const logLoss = (probability: number, outcome: boolean) => {
  const bounded = Math.min(0.98, Math.max(0.02, probability));
  return outcome ? -Math.log(bounded) : -Math.log(1 - bounded);
};

export const wilsonInterval = (
  successes: number,
  total: number,
  z = 1.959963984540054,
): [number, number] => {
  if (total === 0) return [Number.NaN, Number.NaN];
  const proportion = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const spread =
    (z / denominator) *
    Math.sqrt(
      (proportion * (1 - proportion)) / total + z ** 2 / (4 * total ** 2),
    );
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
};

const mulberry32 = (initialSeed: number) => {
  let seed = initialSeed >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const quantile = (sorted: number[], probability: number): number => {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower];
  const upperValue = sorted[upper];
  if (lowerValue === undefined || upperValue === undefined) return Number.NaN;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
};

export const bootstrapMeanInterval = (
  values: number[],
  iterations = 4_000,
  seed = 20_260_815,
): [number, number] => {
  if (values.length === 0) return [Number.NaN, Number.NaN];
  const random = mulberry32(seed);
  const estimates = Array.from({ length: iterations }, () => {
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      const selected = values[Math.floor(random() * values.length)];
      sum += selected ?? 0;
    }
    return sum / values.length;
  }).sort((left, right) => left - right);
  return [quantile(estimates, 0.025), quantile(estimates, 0.975)];
};
