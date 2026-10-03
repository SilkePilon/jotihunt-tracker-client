const clockFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

/** 24 h Dutch clock time in Dutch time (the hunt's time zone, whatever the device's), e.g. "14:05". */
export function formatClock(date: Date | string | number): string {
  return clockFormat.format(new Date(date));
}

/**
 * Format a countdown (rounded up to whole seconds, never negative) as m:ss, h:mm:ss from one hour, or "Xd Yu" from
 * one day.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds >= 86400) return `${Math.floor(totalSeconds / 86400)}d ${Math.floor((totalSeconds % 86400) / 3600)}u`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
