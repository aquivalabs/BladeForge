// CERBERUS push guard, mod layer. Where the engine loads function-hooks mods, this judges every
// `git push` in-process before it runs: it reads the commits the push would send out (messages,
// authors, committers, branch name), asks a model with the same prompt the classic hook uses
// (push-judge-prompt.txt), denies a push that leaks and names what leaked. A clean verdict goes
// into the same cache the classic on-git-push.sh hook reads, keyed by the hash of what was judged,
// so that hook passes without judging twice. Anything this layer cannot decide is left to the
// classic hook beneath, which judges on its own and blocks when it cannot.
import type { Register } from 'claude-code'

const PUSH = /(^|[;&|(\s])git(\s+-[Cc]\s+\S+)*\s+push(\s|$)/
const FMT = '%h author: %an <%ae> committer: %cn <%ce>%n%B%n---'

type Leak = { where: string; what: string }

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!PUSH.test(e.command)) return next(e)
    const git = async (args: string[], stdin?: string) => {
      const r = await $.process.run(['git', ...args], stdin === undefined ? undefined : { stdin })
      return r.exitCode === 0 ? r.stdout.replace(/\n+$/, '') : null
    }
    const gitDir = await git(['rev-parse', '--absolute-git-dir'])
    if (!gitDir) return next(e)
    // The same range and the same text as on-git-push.sh, so both compute the same cache key.
    const base = (await git(['rev-parse', '--abbrev-ref', '@{upstream}'])) !== null ? '@{upstream}'
      : (await git(['rev-parse', '--verify', '-q', 'origin/HEAD'])) !== null ? 'origin/HEAD'
      : (await git(['rev-parse', '--verify', '-q', 'origin/main'])) !== null ? 'origin/main' : null
    const log = await git(['log', `--format=${FMT}`, ...(base ? [`${base}..HEAD`] : ['HEAD'])])
    if (!log) return next(e)
    const branch = (await git(['branch', '--show-current'])) ?? ''
    const key = await git(['hash-object', '--stdin'], `${log}\n${branch}`)
    if (!key) return next(e)
    const verdict = `${gitDir}/cerberus-verdicts/${key}`
    if (await $.fs.read(verdict).then(() => true, () => false)) return next(e)

    const system = await $.fs.read(`${$.plugin.root}/hooks/push-judge-prompt.txt`)
    $.ui.status('cerberus: judging the outgoing commits')
    const r = await $.model.complete({ model: 'sonnet', system, prompt: `<branch>${branch}</branch>\n<commits>\n${log}\n</commits>` })
    $.ui.status(undefined)
    if (!r.isAnswered) return next(e)
    let leaks: Leak[]
    try {
      leaks = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)).leaks
      if (!Array.isArray(leaks)) return next(e)
    } catch {
      return next(e)
    }
    if (leaks.length) {
      $.ui.toast(`cerberus: push stopped, ${leaks.length} leak(s) in the outgoing commits`)
      return {
        deny: `CERBERUS: this push would publish work fingerprints in its commits — ${leaks.map(l => `${l.where}: ${l.what}`).join('; ')}. ` +
          'Fix them with cerberus:leak-check (amend or reword the commits, reset a work author, rename the branch), then push again.',
      }
    }
    await $.fs.write(verdict, 'clean\n')
    $.ui.toast('cerberus: outgoing commits are clean')
    return next(e)
  }).catch(($, e, next) => next(e))
}
