/** The wind directions a tegenhunt can come from (degrees), with Dutch labels. Keep in sync with the server's notifier.helpers. */
export const COUNTER_HUNT_DIRECTIONS = [
  { degrees: 0, short: 'N', name: 'Noord', arrow: '↑' },
  { degrees: 45, short: 'NO', name: 'Noordoost', arrow: '↗' },
  { degrees: 90, short: 'O', name: 'Oost', arrow: '→' },
  { degrees: 135, short: 'ZO', name: 'Zuidoost', arrow: '↘' },
  { degrees: 180, short: 'Z', name: 'Zuid', arrow: '↓' },
  { degrees: 225, short: 'ZW', name: 'Zuidwest', arrow: '↙' },
  { degrees: 270, short: 'W', name: 'West', arrow: '←' },
  { degrees: 315, short: 'NW', name: 'Noordwest', arrow: '↖' },
] as const;

/** The alert title everyone gets, as the server builds it; null for an unknown direction. */
export function counterHuntAlertTitle(degrees: number): string | null {
  const direction = COUNTER_HUNT_DIRECTIONS.find((item) => item.degrees === degrees);
  return direction ? `Tegenhunt! Richting ${direction.short} ${direction.arrow}` : null;
}
