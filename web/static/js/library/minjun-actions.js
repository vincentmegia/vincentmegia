// What Min-jun does when he stops at a corner of his walk (rules only — the
// poses are drawn by minjun.js's `action` option). Kept apart from the
// renderer so it can be unit-tested without a canvas.

/** Roughly how long each action lasts, in seconds (the game varies it ±15%). */
export const MINJUN_ACTION_SECONDS = { read: 6, hum: 4.5, wave: 2.6, help: 2.6 };

/**
 * Picks his next action. He waves when Eun-mi is nearby on his floor (unless
 * he just did); otherwise he reads or hums, never the same one twice running.
 *
 * @param {{coralNear: boolean, last: string|null, random?: () => number}} opts
 * @returns {'read' | 'hum' | 'wave'}
 */
export function pickMinjunAction({ coralNear, last, random = Math.random }) {
  if (coralNear && last !== 'wave') return 'wave';
  if (last === 'read') return 'hum';
  if (last === 'hum') return 'read';
  return random() < 0.6 ? 'read' : 'hum';
}
