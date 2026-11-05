// CERBERUS push guard, mod layer. Where the engine loads function-hooks mods, this judges every
// `git push` in-process before it runs, so the person sees the verdict as a toast instead of a
// second nested claude. What the push would send out, and the cache key of that text, come from
// push-range.mjs — the same script the classic on-git-push.mjs hook imports — so both layers judge
// the same text and share one verdict cache. Anything this layer cannot decide is left to the
// classic hook beneath, which judges on its own and blocks when it cannot.
import type { Register } from 'claude-code'

const PUSH = /(^|[;&|(\s])git(\s+-[Cc]\s+\S+)*\s+push(\s|$)/

type Range = { off: boolean; scope?: 'all' | 'secrets'; gitDir: string; log?: string; branch?: string; key?: string; cached?: boolean; allow?: string[] }
type Leak = { where: string; what: string }

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!PUSH.test(e.command)) return next(e)
    const script = `${$.plugin.root}/hooks/push-range.mjs`
    const out = await $.process.run(['node', script, '.', e.command])
    const range: Range | null = out.exitCode === 0 ? JSON.parse(out.stdout) : null
    if (!range || range.off || !range.log || range.cached) return next(e)

    const system = await $.fs.read(`${$.plugin.root}/hooks/${range.scope === 'secrets' ? 'push-judge-secrets-prompt.txt' : 'push-judge-prompt.txt'}`)
    $.ui.status('cerberus: judging the outgoing commits')
    const accepted = range.allow?.length ? `\nThe person has accepted these fingerprints for this repository; do not report them: ${JSON.stringify(range.allow)}` : ''
    const r = await $.model.complete({ model: 'sonnet', system: system + accepted, prompt: `<branch>${range.branch}</branch>\n<commits>\n${range.log}\n</commits>` })
    $.ui.status(undefined)
    const leaks = ((): Leak[] | null => {
      if (!r.isAnswered) return null
      try { return JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)).leaks } catch { return null }
    })()
    if (!Array.isArray(leaks)) return next(e)
    // A finding off the whitelist goes to the classic hook beneath, which asks the person about it.
    const fresh = leaks.filter(l => !(range.allow ?? []).includes(String(l.what).trim()))
    if (fresh.length) {
      $.ui.toast(`cerberus: ${fresh.length} finding(s) not on the whitelist; asking you`)
      return next(e)
    }
    await $.process.run(['node', script, 'record', range.gitDir, range.key!])
    $.ui.toast('cerberus: outgoing commits are clean')
    return next(e)
  }).catch(($, e, next) => next(e))
}
