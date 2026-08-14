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

const currencyPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number, compact = true): string =>
  (compact ? currencyCompact : currencyFull).format(value);

export const formatCurrencyPrecise = (value: number): string => {
  if (!Number.isFinite(value)) return "Overflow";
  if (Math.abs(value) >= 1_000_000_000_000) {
    const sign = value < 0 ? "−" : "";
    return `${sign}$${Math.abs(value).toExponential(3)}`;
  }
  return currencyPrecise.format(value);
};

export const formatPercent = (value: number, digits = 1): string => {
  if (!Number.isFinite(value)) return "Overflow";
  if (Math.abs(value) >= 1_000_000) {
    const [coefficient, rawExponent] = value.toExponential(digits).split("e");
    const exponent = Number(rawExponent) + 2;
    return `${coefficient}e${exponent >= 0 ? "+" : ""}${exponent}%`;
  }
  return `${(value * 100).toFixed(digits)}%`;
};

export const formatRatio = (value: number | null): string =>
  value === null ? "—" : decimal.format(value);
