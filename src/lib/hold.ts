/** Hold-to-confirm maths: how far a press has filled the button, and whether it has been held long enough. */

/** Share of the hold done after `elapsedMs`, clamped to 0..1; a zero or negative duration is done at once. */
export function holdProgressAfter(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 1;
  if (!(elapsedMs > 0)) return 0;
  return Math.min(1, elapsedMs / durationMs);
}

/** True once the press has lasted the full duration (exactly `durationMs` counts). */
export function isHoldComplete(elapsedMs: number, durationMs: number): boolean {
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return false;
  return holdProgressAfter(elapsedMs, durationMs) >= 1;
}
