import { formatReminderAge, isPastReminderCutoff, leadStaleNotice, mayRemindAgain, reminderAgeMs, reminderFooter } from './harness-reminder.js';
import { HARNESS_REMINDER_CONSTANTS } from '../../constants.js';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const H = 60 * 60_000;

describe('harness reminder helpers', () => {
  it('formats ages', () => {
    expect(formatReminderAge(5 * 60_000)).toBe('5 min');
    expect(formatReminderAge(3 * H)).toBe('3 h');
    expect(formatReminderAge(72 * H)).toBe('3 days');
  });

  it('age is null when the time is unknown', () => {
    expect(reminderAgeMs(undefined, NOW)).toBeNull();
    expect(reminderAgeMs('garbage', NOW)).toBeNull();
    expect(reminderAgeMs(NOW - H, NOW)).toBe(H);
  });

  it('cutoff applies at the constant, never to unknown ages', () => {
    expect(isPastReminderCutoff(NOW - HARNESS_REMINDER_CONSTANTS.CUTOFF_MS + 1, NOW)).toBe(false);
    expect(isPastReminderCutoff(NOW - HARNESS_REMINDER_CONSTANTS.CUTOFF_MS, NOW)).toBe(true);
    expect(isPastReminderCutoff(undefined, NOW)).toBe(false);
  });

  it('caps reminders per item', () => {
    expect(mayRemindAgain(HARNESS_REMINDER_CONSTANTS.MAX_REMINDERS_PER_ITEM - 1)).toBe(true);
    expect(mayRemindAgain(HARNESS_REMINDER_CONSTANTS.MAX_REMINDERS_PER_ITEM)).toBe(false);
  });

  it('footer names the attempt and age and forbids re-posting', () => {
    const text = reminderFooter(2, new Date(NOW - 5 * H).toISOString(), NOW);
    expect(text).toContain('Automatic reminder 2 of 2');
    expect(text).toContain('5 h ago');
    expect(text).toContain('send NOTHING to the owner');
    expect(text).toContain('Never re-post');
  });

  it('lead notice does not tell the lead to message the owner', () => {
    const text = leadStaleNotice('TKT-1: send the doc', 'atlas', NOW - 72 * H, NOW);
    expect(text).toContain('atlas');
    expect(text).toContain('3 days');
    expect(text).toContain('Do not message the owner');
  });
});
