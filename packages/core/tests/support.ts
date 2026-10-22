/**
 * Values shared by the test suites that need a switch to *fail*.
 *
 * This file exists because of one bug that cost three incidents and blocked a release: tests wrote
 * the target of a switch that had to fail as a literal, and a literal is a bet. `99` and `14` are
 * legal hex prefixes, a session's short id is six random hex digits, so on roughly one run in 256
 * the switch the test required to fail *succeeded* — and the failure looked like a platform flake.
 *
 * The resolver now refuses to reinterpret a number (a number is only ever a row of the listing), so
 * that particular bet is gone. This helper is here so the next such test does not place a new one:
 * it is the sanctioned spelling of "a target that names nothing", generated rather than remembered.
 */

import { randomUUID } from 'node:crypto'

/**
 * A switch target that names no conversation.
 *
 * Every reading `resolveTarget` has refuses it:
 *
 * - **a row number** — it contains letters, so it is never a number;
 * - **an exact id, an id prefix, an id suffix** — ids are `session-<hex>-<uuid>`, and no id contains
 *   `#`, so the value can neither equal one nor be a prefix or suffix of one;
 * - **an exact title** — no title this channel writes looks like this (`微信 <hex>`, or the user's own
 *   words), and no fixture in either suite does;
 * - **a title fragment** — the random tail means no title in these suites is a substring of the
 *   value, and the value is not a substring of any of them. That is the one reading data could still
 *   defeat (a fixture titled `#` would, absurdly), which is why `core.test.ts` resolves this helper
 *   against a deliberately hostile machine and asserts it still names nothing, instead of trusting
 *   this comment.
 *
 * The random tail is the point: a fixed `zzzzzzz` is only *improbable*, and "improbable" is the
 * assumption that failed three times. Deliberately no words: a title such as `switch` would otherwise
 * be a substring of the target.
 */
export function unmatchedSwitchTarget(): string {
  return `#${randomUUID()}`
}
