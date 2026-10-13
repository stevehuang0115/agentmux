import { readFileSync } from 'fs';
import { join } from 'path';
import { findSkillFiles, lintSkill, MAX_DESCRIPTION_CHARS, type SkillLintViolation } from './skill-lint';

/**
 * Skill authoring lint: description present and under the limit, triggers
 * present with no duplicates. Pre-existing violations are listed in
 * skill-lint.allowlist.json with a reason; a listed skill that is now clean
 * must be removed from it, so the list only shrinks. Do not rewrite old skills
 * here; fix new ones.
 */
const SKILLS_DIR = join(__dirname, '..');
const ALLOWLIST: Array<{ file: string; rule: string; reason: string }> = JSON.parse(
  readFileSync(join(__dirname, 'skill-lint.allowlist.json'), 'utf-8'),
);

const files = findSkillFiles(SKILLS_DIR);
const violations: SkillLintViolation[] = files.flatMap((f) => lintSkill(f, SKILLS_DIR));
const key = (v: { file: string; rule: string }) => `${v.file}::${v.rule}`;
const allowed = new Set(ALLOWLIST.map(key));

describe('skill authoring lint', () => {
  it('finds skills and reports the count (zero is a failure, not a pass)', () => {
    // eslint-disable-next-line no-console
    console.info(`skill-lint: ${files.length} skill(s) checked, ${violations.length} known violation(s) allowlisted`);
    expect(files.length).toBeGreaterThan(0);
  });

  it(`passes every skill, or lists it in the allowlist with a reason (description max ${MAX_DESCRIPTION_CHARS} chars)`, () => {
    const fresh = violations.filter((v) => !allowed.has(key(v)));
    expect(fresh.map((v) => `${v.file}: ${v.rule} (${v.detail})`)).toEqual([]);
  });

  it('keeps no stale allowlist entry (a fixed skill leaves the list)', () => {
    const live = new Set(violations.map(key));
    expect(ALLOWLIST.filter((a) => !live.has(key(a))).map(key)).toEqual([]);
  });

  it('gives every allowlist entry a reason', () => {
    expect(ALLOWLIST.filter((a) => !a.reason || a.reason.trim().length < 5)).toEqual([]);
  });

  it('flags the three rules on a bad skill', () => {
    const { mkdtempSync, writeFileSync, rmSync } = require('fs');
    const { tmpdir } = require('os');
    const dir = mkdtempSync(join(tmpdir(), 'sl-'));
    try {
      writeFileSync(join(dir, 'SKILL.md'), `---\nname: X\ndescription: "${'a'.repeat(MAX_DESCRIPTION_CHARS + 1)}"\ntriggers:\n  - Foo\n  - foo\n---\n`);
      expect(lintSkill(join(dir, 'SKILL.md'), dir).map((v) => v.rule).sort()).toEqual(['description-too-long', 'triggers-duplicate']);
      writeFileSync(join(dir, 'SKILL.md'), '---\nname: X\n---\n');
      expect(lintSkill(join(dir, 'SKILL.md'), dir).map((v) => v.rule).sort()).toEqual(['description-missing', 'triggers-missing']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
