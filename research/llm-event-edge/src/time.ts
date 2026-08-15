const NEW_YORK = "America/New_York";

export const marketCloseIso = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  const desiredWallTime = Date.UTC(year, month - 1, day, 16);
  const guess = new Date(desiredWallTime);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(({ type }) => type === name)?.value);
  const guessWallTime = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return new Date(
    desiredWallTime - (guessWallTime - desiredWallTime),
  ).toISOString();
};
