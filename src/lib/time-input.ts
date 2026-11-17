/** A complete "HH:MM" from a time input (partial or cleared fields give '' or junk). */
const TIME_VALUE = /^(\d{2}):(\d{2})$/;

const isValidDate = (date: unknown): date is Date => date instanceof Date && !Number.isNaN(date.getTime());

/**
 * The date of `base` (or `fallback` when `base` is no valid date, e.g. after an earlier cleared field) at the time of a
 * time input's value; an Invalid Date while the value isn't a complete, real "HH:MM", so the form says "Geen geldige
 * tijd." until it is. Never mutates `base`.
 */
export function withTimeOfDay(base: unknown, value: string, fallback: Date): Date {
  const match = TIME_VALUE.exec(value);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!(hours < 24 && minutes < 60)) return new Date(NaN);
  const date = new Date(isValidDate(base) ? base : fallback);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** "HH:MM" for a time input; '' for no valid date (an empty field, not "Inval"). */
export function timeInputValue(value: unknown): string {
  return isValidDate(value) ? value.toTimeString().substring(0, 5) : '';
}
