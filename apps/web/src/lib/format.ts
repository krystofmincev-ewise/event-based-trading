const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  notation: "compact",
});

const currencyFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number, compact = true): string =>
  (compact ? currencyCompact : currencyFull).format(value);

export const formatPercent = (value: number, digits = 1): string =>
  `${(value * 100).toFixed(digits)}%`;

export const formatRatio = (value: number | null): string =>
  value === null ? "—" : decimal.format(value);
