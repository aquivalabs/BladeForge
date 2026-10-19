// claude plugin test plugins/cerberus
// The test's own hooks stand for the engine beneath the mod: they answer push-range.mjs, the model
// and the filesystem, and a `tool.call` hook beneath records whether the push itself would have run.
import { expect, test } from 'claude-code/testing'

const KEY = 'k3y0f7h3j0dg3d'
const out = (stdout: string, exitCode = 0) =>
  ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

function engine(on: any, { leaks, range }: { leaks: unknown[]; range?: Record<string, unknown> }) {
  const recorded: string[][] = []
  let pushed = false
  on('process.run', ($: any, e: any) => {
    const [, , cmd, ...rest] = e.argv
    if (cmd === 'record') { recorded.push(rest); return out('') }
    return out(JSON.stringify({ off: false, gitDir: '/repo/.git', branch: 'main', key: KEY, cached: false,
      log: 'a1b2c3d author: Demo <d@example.com> committer: Demo <d@example.com>\nfix: Halvorsen retry for HLD-4412\n---',
      ...range }))
  })
  on('fs.read', () => ({ value: 'judge prompt' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: JSON.stringify({ leaks }),
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }))
  on('tool.call', { tool: 'Bash' }, () => { pushed = true; return { result: { stdout: 'pushed', stderr: '', interrupted: false } } })
  return { recorded, wasPushed: () => pushed }
}

test('a push whose commits leak is stopped, and nothing is cached', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'a1b2c3d', what: 'Halvorsen, HLD-4412' }] })
  const r: any = await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(env.wasPushed()).toBe(false)
  expect(JSON.stringify(r)).toContain('Halvorsen')
  expect(env.recorded.length).toBe(0)
})

test('a clean push runs and records its verdict under the content key', async ($, on) => {
  const env = engine(on, { leaks: [] })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(env.wasPushed()).toBe(true)
  expect(env.recorded).toEqual([['/repo/.git', KEY]])
})

test('a push already judged clean, or turned off, passes without asking the model', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'x', what: 'y' }], range: { cached: true } })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(env.wasPushed()).toBe(true)
})

test('a command that is not a push is not touched', async ($, on) => {
  const env = engine(on, { leaks: [{ where: 'x', what: 'y' }] })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(env.wasPushed()).toBe(true)
  expect(env.recorded.length).toBe(0)
})
