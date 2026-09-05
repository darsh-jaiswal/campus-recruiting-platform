/**
 * Recruiter interest — a tri-state, and the toggle that drives it.
 *
 * `null` (not yet reviewed) is a real state, distinct from `false` (passed).
 * A set nobody has opened must never read as a set where everyone was
 * rejected, so this cannot collapse to a boolean.
 *
 * Pure, with no I/O, so the toggle behaviour is testable without a database or
 * a rendered form — the same reason `access-policy.ts` is shaped this way.
 * Both the Server Action and the row component go through these functions, so
 * the two can't drift apart on what a click means.
 */

export type Interest = boolean | null;

/**
 * Read a submitted interest value.
 *
 * Anything that is not exactly `"true"` or `"false"` — including an empty
 * string, a missing field, or a junk value — means "not reviewed". Clearing is
 * the safe default: an unparseable submission must never be read as approval.
 */
export function parseInterest(raw: unknown): Interest {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * The value a button should submit, given the current state.
 *
 * Pressing the button you are already on clears the mark rather than re-setting
 * it, so a mis-click is recoverable without a third "undo" control.
 */
export function toggleValue(current: Interest, target: boolean): string {
  return current === target ? "" : String(target);
}
