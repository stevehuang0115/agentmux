/**
 * Team Utilities
 *
 * Shared helper functions and constants for team-related operations,
 * such as assigning default avatars to team members during migration.
 *
 * @module utils/team.utils
 */

/** Default avatar choices for team members (migration/backward-compat). */
export const AVATAR_CHOICES = [
  'https://picsum.photos/seed/1/64',
  'https://picsum.photos/seed/2/64',
  'https://picsum.photos/seed/3/64',
  'https://picsum.photos/seed/4/64',
  'https://picsum.photos/seed/5/64',
  'https://picsum.photos/seed/6/64',
];

/**
 * Assign default avatars to members that don't already have one.
 *
 * Cycles through AVATAR_CHOICES by index for deterministic assignment.
 *
 * @param members - Array of objects that may include an optional `avatar` field
 * @returns A new array with avatars filled in where missing
 */
export function assignDefaultAvatars<T extends { avatar?: string }>(members: T[]): T[] {
  return members.map((member, index) => ({
    ...member,
    avatar: member.avatar || AVATAR_CHOICES[index % AVATAR_CHOICES.length],
  }));
}
