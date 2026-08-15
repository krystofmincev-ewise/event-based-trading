export interface SettledVolatilityObservation {
  actual: boolean;
  entryDate: string;
  settlementDate: string;
  volatility: number;
}

const clampProbability = (value: number) =>
  Math.min(1 - 1e-9, Math.max(1e-9, value));

// Abramowitz and Stegun 7.1.26; adequate for probability baselines.
export const standardNormalCdf = (value: number): number => {
  const absolute = Math.abs(value);
  const scale = 1 / (1 + 0.231_641_9 * absolute);
  const density = Math.exp(-(absolute ** 2) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    scale *
    (0.319_381_53 +
      scale *
        (-0.356_563_782 +
          scale *
            (1.781_477_937 +
              scale * (-1.821_255_978 + scale * 1.330_274_429))));
  return value >= 0 ? 1 - tail : tail;
};

export const probabilityAbsoluteNormalMove = (
  annualizedVolatility: number,
  sessions: number,
  threshold: number,
): number => {
  if (
    !Number.isFinite(annualizedVolatility) ||
    annualizedVolatility <= 0 ||
    !Number.isInteger(sessions) ||
    sessions <= 0 ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    throw new Error("Volatility, sessions, and threshold must be positive.");
  }
  const horizonVolatility = annualizedVolatility * Math.sqrt(sessions / 252);
  return clampProbability(
    2 * (1 - standardNormalCdf(threshold / horizonVolatility)),
  );
};

const logit = (value: number) => 1 / (1 + Math.exp(-value));

const fitRegularizedLogistic = (
  observations: Array<{ feature: number; actual: boolean }>,
): { intercept: number; slope: number } => {
  let intercept = 0;
  let slope = 0;
  const ridge = 1;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    let gradientIntercept = -ridge * intercept;
    let gradientSlope = -ridge * slope;
    let hessianIntercept = ridge;
    let hessianSlope = ridge;
    let hessianCross = 0;
    for (const { feature, actual } of observations) {
      const probability = logit(intercept + slope * feature);
      const residual = Number(actual) - probability;
      const weight = probability * (1 - probability);
      gradientIntercept += residual;
      gradientSlope += residual * feature;
      hessianIntercept += weight;
      hessianSlope += weight * feature ** 2;
      hessianCross += weight * feature;
    }
    const determinant = hessianIntercept * hessianSlope - hessianCross ** 2;
    if (determinant <= 1e-12) break;
    const interceptStep =
      (hessianSlope * gradientIntercept - hessianCross * gradientSlope) /
      determinant;
    const slopeStep =
      (hessianIntercept * gradientSlope - hessianCross * gradientIntercept) /
      determinant;
    intercept += interceptStep;
    slope += slopeStep;
    if (Math.max(Math.abs(interceptStep), Math.abs(slopeStep)) < 1e-9) break;
  }
  return { intercept, slope };
};

const forecastFromTraining = (
  training: SettledVolatilityObservation[],
  volatility: number,
): number => {
  if (training.length < 20) {
    const positives = training.filter(({ actual }) => actual).length;
    return (positives + 0.5) / (training.length + 1);
  }
  const logVolatilities = training.map(({ volatility: value }) =>
    Math.log(value),
  );
  const mean =
    logVolatilities.reduce((sum, value) => sum + value, 0) /
    logVolatilities.length;
  const standardDeviation = Math.max(
    1e-6,
    Math.sqrt(
      logVolatilities.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        logVolatilities.length,
    ),
  );
  const model = fitRegularizedLogistic(
    training.map(({ volatility: value, actual }) => ({
      feature: (Math.log(value) - mean) / standardDeviation,
      actual,
    })),
  );
  return clampProbability(
    logit(
      model.intercept +
        model.slope * ((Math.log(volatility) - mean) / standardDeviation),
    ),
  );
};

export const prequentialVolatilityProbabilities = (
  observations: SettledVolatilityObservation[],
): number[] =>
  observations.map((observation) =>
    forecastFromTraining(
      observations.filter(
        (candidate) => candidate.settlementDate < observation.entryDate,
      ),
      observation.volatility,
    ),
  );

export const purgedCrossFittedVolatilityProbabilities = (
  observations: SettledVolatilityObservation[],
): number[] =>
  observations.map((observation) =>
    forecastFromTraining(
      observations.filter(
        (candidate) =>
          candidate.settlementDate < observation.entryDate ||
          observation.settlementDate < candidate.entryDate,
      ),
      observation.volatility,
    ),
  );
