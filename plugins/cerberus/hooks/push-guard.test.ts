// claude plugin test plugins/cerberus
// The test's own hooks stand for the engine beneath the mod: they answer git, the model and the
// filesystem, and a `tool.call` hook beneath records whether the push itself would have run.
import { expect, test } from 'claude-code/testing'

const HEAD = 'a1b2c3d4'

function engine(on: any, { leaks, marker }: { leaks: unknown[]; marker?: string }) {
  const written: string[] = []
  let pushed = false
  on('process.run', ($: any, e: any) => {
    const a = e.argv.slice(1).join(' ')
    if (a === 'rev-parse HEAD') return { value: { exitCode: 0, stdout: `${HEAD}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (a === 'rev-parse --absolute-git-dir') return { value: { exitCode: 0, stdout: '/repo/.git\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (a.startsWith('rev-parse --abbrev-ref')) return { value: { exitCode: 0, stdout: 'origin/main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (a.startsWith('log')) return { value: { exitCode: 0, stdout: 'a1b2c3d author: Demo <d@example.com> committer: Demo <d@example.com>\nfix: Halvorsen retry for HLD-4412\n---', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (a.startsWith('branch')) return { value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', () => (marker ? { value: marker } : { deny: 'ENOENT' }))
  on('fs.write', ($: any, e: any) => { written.push(e.path); return { value: undefined } })
  on('model.complete', () => ({ value: { isAnswered: true, text: JSON.stringify({ leaks }), usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }))
  on('tool.call', { tool: 'Bash' }, () => { pushed = true; return { result: { stdout: 'pushed', stderr: '', interrupted: false } } })
  return { written, wasPushed: () => pushed }
}

test('a push whose commits leak is stopped, and nothing is marked', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'a1b2c3d', what: 'Halvorsen, HLD-4412' }] })
  const r: any = await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(env.wasPushed()).toBe(false)
  expect(JSON.stringify(r)).toContain('Halvorsen')
  expect(env.written.length).toBe(0)
})

test('a clean push runs and writes the marker for this HEAD', async ($, on) => {
  const env = engine(on, { leaks: [] })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(env.wasPushed()).toBe(true)
  expect(env.written).toEqual(['/repo/.git/cerberus-leak-checked'])
})

test('a HEAD already marked passes without asking the model', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'x', what: 'y' }], marker: `${HEAD}\n` })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(env.wasPushed()).toBe(true)
})

test('a command that is not a push is not touched', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'x', what: 'y' }] })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(env.wasPushed()).toBe(true)
  expect(env.written.length).toBe(0)
})
