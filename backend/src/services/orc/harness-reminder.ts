/**
 * Shared wording and limits for harness reminders (follow-up, owner report
 * due, follow-through). A reminder tells the agent which attempt it is, how old
 * the original request is, and that an agent which already answered posts
 * nothing to the owner (audit 2026-10-14: reminders re-posted the same Google
 * Doc link; 77 of 317 were sent more than 24h after the request).
 *
 * @module services/orc/harness-reminder
 */

import { HARNESS_REMINDER_CONSTANTS } from '../../constants.js';

/**
 * Human age of a request ("5 min", "3 h", "2 days").
 *
 * @param ms - Age in milliseconds
 * @returns Short English age
 */
export function formatReminderAge(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * Milliseconds since an ISO timestamp / epoch ms.
 *
 * @param since - When the original request happened
 * @param now - Epoch ms
 * @returns Age, or null when unknown
 */
export function reminderAgeMs(since: string | number | undefined, now: number): number | null {
  const at = typeof since === 'number' ? since : since ? Date.parse(since) : NaN;
  return Number.isFinite(at) ? Math.max(0, now - at) : null;
}

/**
 * Whether the original request is too old to be reminded about.
 *
 * @param since - When the original request happened
 * @param now - Epoch ms
 * @returns True when older than {@link HARNESS_REMINDER_CONSTANTS.CUTOFF_MS}
 */
export function isPastReminderCutoff(since: string | number | undefined, now: number): boolean {
  const age = reminderAgeMs(since, now);
  return age !== null && age >= HARNESS_REMINDER_CONSTANTS.CUTOFF_MS;
}

/**
 * Whether one more reminder would pass the per-item cap.
 *
 * @param sent - Reminders (including the first prompt) already sent for the item
 * @returns True when another may be sent
 */
export function mayRemindAgain(sent: number): boolean {
  return sent < HARNESS_REMINDER_CONSTANTS.MAX_REMINDERS_PER_ITEM;
}

/**
 * The lines every reminder carries: attempt number, request age, and the
 * never-re-post rule.
 *
 * @param attempt - 1-based attempt number
 * @param since - When the original request happened
 * @param now - Epoch ms
 * @returns Text starting with a newline, ready to append to a reminder
 */
export function reminderFooter(attempt: number, since: string | number | undefined, now: number): string {
  const age = reminderAgeMs(since, now);
  const ageText = age === null ? 'age unknown' : `${formatReminderAge(age)} ago`;
  return (
    `\n(Automatic reminder ${attempt} of ${HARNESS_REMINDER_CONSTANTS.MAX_REMINDERS_PER_ITEM}; the original request was ${ageText}.) ` +
    'If you already delivered or answered this, send NOTHING to the owner: just close the item with the usual command. ' +
    'Never re-post content the owner already has (links, files, summaries).'
  );
}

/**
 * The note for the team lead when a request is too old to remind the agent.
 *
 * @param what - What the request / promise was
 * @param agent - The agent it belongs to
 * @param since - When the original request happened
 * @param now - Epoch ms
 * @returns English harness text
 */
export function leadStaleNotice(what: string, agent: string, since: string | number | undefined, now: number): string {
  const age = reminderAgeMs(since, now);
  return (
    `[STALE ITEM] ${agent} still has an item from ${age === null ? 'a while' : `${formatReminderAge(age)}`} ago open: "${what.slice(0, 200)}". ` +
    'Crewly stopped reminding the agent (too old). Decide whether it is still needed: close it or re-assign it. ' +
    'Do not message the owner about it unless it is still wanted and nobody has told them.'
  );
}
