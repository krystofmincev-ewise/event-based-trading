const MAX_LOG_VALUE = Math.log(Number.MAX_VALUE);
const MIN_LOG_VALUE = Math.log(Number.MIN_VALUE);

export interface BankrollStep {
  logCapital: number;
  capital: number;
  literalZero: boolean;
  overflowed: boolean;
  underflowed: boolean;
}

export const capitalFromLog = (
  logCapital: number,
): { capital: number; overflowed: boolean; underflowed: boolean } => {
  if (logCapital === Number.NEGATIVE_INFINITY)
    return { capital: 0, overflowed: false, underflowed: false };
  if (logCapital >= MAX_LOG_VALUE)
    return {
      capital: Number.MAX_VALUE,
      overflowed: true,
      underflowed: false,
    };
  if (logCapital <= MIN_LOG_VALUE)
    return {
      capital: Number.MIN_VALUE,
      overflowed: false,
      underflowed: true,
    };
  return {
    capital: Math.exp(logCapital),
    overflowed: false,
    underflowed: false,
  };
};

export const updateLogCapital = (
  logCapital: number,
  won: boolean,
  fraction: number,
  netWinMultiple: number,
): BankrollStep => {
  if (!won && fraction === 1) {
    return {
      logCapital: Number.NEGATIVE_INFINITY,
      capital: 0,
      literalZero: true,
      overflowed: false,
      underflowed: false,
    };
  }
  const nextLogCapital =
    logCapital +
    (won ? Math.log1p(fraction * netWinMultiple) : Math.log1p(-fraction));
  const converted = capitalFromLog(nextLogCapital);
  return { logCapital: nextLogCapital, literalZero: false, ...converted };
};

export const drawdownFromLogCapital = (
  logCapital: number,
  peakLogCapital: number,
): number => {
  if (logCapital === Number.NEGATIVE_INFINITY) return 1;
  return -Math.expm1(logCapital - peakLogCapital);
};

export const returnBetweenLogCapitals = (
  logCapital: number,
  previousLogCapital: number,
): number => {
  if (logCapital === Number.NEGATIVE_INFINITY) {
    return previousLogCapital === Number.NEGATIVE_INFINITY ? 0 : -1;
  }
  if (previousLogCapital === Number.NEGATIVE_INFINITY) return 0;
  return Math.expm1(logCapital - previousLogCapital);
};

export const calculateMaximumDrawdown = (capitals: readonly number[]) => {
  if (capitals.length === 0)
    throw new Error("A capital path must contain at least one value.");
  let peak = capitals[0]!;
  let maximumFraction = 0;
  let maximumNominal = 0;
  for (const capital of capitals) {
    peak = Math.max(peak, capital);
    maximumFraction = Math.max(
      maximumFraction,
      peak === 0 ? 0 : 1 - capital / peak,
    );
    maximumNominal = Math.max(maximumNominal, peak - capital);
  }
  return { fraction: maximumFraction, nominal: maximumNominal };
};

export const simulateOutcomeSequence = (
  startingCapital: number,
  fraction: number,
  netWinMultiple: number,
  outcomes: readonly boolean[],
) => {
  const capitals = [startingCapital];
  let logCapital = Math.log(startingCapital);
  for (const won of outcomes) {
    const step = updateLogCapital(logCapital, won, fraction, netWinMultiple);
    logCapital = step.logCapital;
    capitals.push(step.capital);
  }
  return { capitals, maximumDrawdown: calculateMaximumDrawdown(capitals) };
};
