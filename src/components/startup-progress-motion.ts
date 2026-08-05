const clamp = (minimum: number, maximum: number, value: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

/**
 * Gives large startup jumps enough screen time to read, with extra time in the
 * final fifth where room restoration typically does the most work.
 */
export function startupProgressTweenDuration(from: number, to: number): number {
  const start = clamp(0, 100, Number.isFinite(from) ? from : 0);
  const end = clamp(0, 100, Number.isFinite(to) ? to : start);
  const distance = Math.abs(end - start);
  if (distance < .01) return 0;

  const travel = clamp(.65, 3.6, distance / 18);
  const finalInterval = clamp(0, 1, (end - 80) / 20);
  return Math.min(6, travel + finalInterval * 4);
}
