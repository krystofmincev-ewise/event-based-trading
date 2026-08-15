export const asRecord = (
  value: unknown,
  context: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
};

export const optionalRecord = (
  value: unknown,
): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asArray = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value;
};

export const asString = (value: unknown, context: string): string => {
  if (typeof value !== "string") throw new Error(`${context} must be text.`);
  return value;
};

export const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

export const optionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replaceAll("$", "").replaceAll(",", "").trim();
  if (normalized.length === 0 || normalized.toUpperCase() === "N/A")
    return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isoDate = (value: string, context: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${context} must use YYYY-MM-DD.`);
  }
  return value;
};
