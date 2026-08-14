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
  const span = domainMaximum - domainMinimum || 1;
  return (value: number): number =>
    rangeMinimum +
    ((value - domainMinimum) / span) * (rangeMaximum - rangeMinimum);
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
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.05, 1);
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.08;
  return [minimum - padding, maximum + padding];
};
