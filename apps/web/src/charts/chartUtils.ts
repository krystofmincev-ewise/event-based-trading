export interface Point {
  x: number;
  y: number;
}

export const linearScale = (
  domainMinimum: number,
  domainMaximum: number,
  rangeMinimum: number,
  rangeMaximum: number,
) => {
  const domainScale = Math.max(
    Math.abs(domainMinimum),
    Math.abs(domainMaximum),
    1,
  );
  const normalizedMinimum = domainMinimum / domainScale;
  const normalizedSpan = domainMaximum / domainScale - normalizedMinimum || 1;
  return (value: number): number =>
    rangeMinimum +
    ((value / domainScale - normalizedMinimum) / normalizedSpan) *
      (rangeMaximum - rangeMinimum);
};

export const pathFromPoints = (points: Point[]): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join(" ");

export const polygonFromBands = (upper: Point[], lower: Point[]): string =>
  `${pathFromPoints(upper)} ${[...lower]
    .reverse()
    .map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ")} Z`;

export const finiteDomain = (values: number[]): [number, number] => {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.05, 1);
    const lower = minimum - padding;
    const upper = maximum + padding;
    return [
      Number.isFinite(lower) ? lower : -Number.MAX_VALUE,
      Number.isFinite(upper) ? upper : Number.MAX_VALUE,
    ];
  }
  const normalizedSpan = maximum / scale - minimum / scale;
  const padding = scale * normalizedSpan * 0.08;
  const lower = minimum - padding;
  const upper = maximum + padding;
  return [
    Number.isFinite(lower) ? lower : -Number.MAX_VALUE,
    Number.isFinite(upper) ? upper : Number.MAX_VALUE,
  ];
};
