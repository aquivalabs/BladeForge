import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredSkills, proofTail, readSkillProofs, skillPath } from '../skill-proofs.mjs';

const config = { agents: [
  { name: 'craft', skills: ['frontend-css:rem', 'meta:ockham'], extensionSkill: 'no-code-prose:policy' },
  { name: 'tests', enabled: false, skills: ['tests:architecture'] },
] };

test('configured skills are the enabled lenses skills and extension skills, once each', () => {
  assert.deepEqual(configuredSkills(config), ['frontend-css:rem', 'meta:ockham', 'no-code-prose:policy']);
});

test('a skill resolves in the marketplace clone and in the newest version of the install cache', () => {
  assert.equal(skillPath('/m/plugins/review/agents', 'frontend-css:rem'), '/m/plugins/frontend-css/skills/rem/SKILL.md');
  const cache = mkdtempSync(join(tmpdir(), 'skill-cache-'));
  try {
    mkdirSync(join(cache, 'review', '2.0.0', 'agents'), { recursive: true });
    mkdirSync(join(cache, 'meta', '1.9.0'), { recursive: true });
    mkdirSync(join(cache, 'meta', '1.10.0'), { recursive: true });
    assert.equal(skillPath(join(cache, 'review', '2.0.0', 'agents'), 'meta:ockham'), join(cache, 'meta', '1.10.0', 'skills', 'ockham', 'SKILL.md'));
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test('every readable skill is returned and an unreadable or empty one is named missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-clone-'));
  try {
    const put = (plugin, skill, text) => {
      mkdirSync(join(root, 'plugins', plugin, 'skills', skill), { recursive: true });
      writeFileSync(join(root, 'plugins', plugin, 'skills', skill, 'SKILL.md'), text);
    };
    put('frontend-css', 'rem', Array.from({ length: 10 }, (_, index) => `rule line number ${index + 1} of the skill`).join('\n'));
    put('meta', 'ockham', '   ');
    const { proofs, missing } = readSkillProofs(join(root, 'plugins', 'review', 'agents'), config);
    assert.deepEqual(proofs, { 'frontend-css:rem': { path: join(root, 'plugins', 'frontend-css', 'skills', 'rem', 'SKILL.md'), line: 9, text: 'rule line number 9 of the skill\nrule line number 10 of the skill' } });
    assert.deepEqual(missing, ['meta:ockham', 'no-code-prose:policy']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the proof is the last fifth of the file, and a tail with no line long enough to quote is none', () => {
  assert.deepEqual(proofTail(['# Title', 'a long first rule line', 'x', 'another long rule line', 'the closing rule of this skill'].join('\n')), { line: 5, text: 'the closing rule of this skill' });
  assert.equal(proofTail(['a long first rule line here', 'x', 'y', 'z', 'end'].join('\n')), null);
});
