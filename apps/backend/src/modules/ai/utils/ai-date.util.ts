export function getUtcUsageDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getNextUtcMidnight(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}
