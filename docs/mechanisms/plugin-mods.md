# Mechanism: plugin mods (Claude Code function hooks)

## What it is

A mod is a plugin hook written as code that runs inside Claude Code, not as a command it starts. It
can rewrite or refuse a tool call, call a model, run a process, and draw above the prompt. The API is
early access: Claude Code's own declaration file says it "may change between releases without
notice", and the public hooks documentation does not describe it. Everything below was read from
Claude Code 2.1.309: its bundled `plugin-authoring` skill (`reference.md`, the generated
`types/claude-code.d.ts`, the examples) and the built-in You should know plugin inside the binary
(RMA-407).

## The arrangement

| piece | role |
|---|---|
| `hooks/hooks.json` → `"modules": ["./<file>.ts"]` | names the plugin's one hooks module, beside its classic `"hooks"` entries; both kinds load from the same file |
| the module (`.ts`, `.tsx`, `.js`, `.mjs` …) | exports `register(on)`; each `on(event, matcher?, hook)` adds a hook `($, e, next)`. `e` is the event's input; `next(e)` runs the plugins beneath and then Claude Code's own behaviour. A hook that returns without `next` answers for itself |
| `$` | the engine interface, always `$.noun.method(...)`: `$.ui.toast`, `$.ui.status`, `$.ui.resolve`, `$.model.complete` / `fork` / `classify`, `$.process.run`, `$.prompt.read` / `fill`, `$.state` (one session), `$.store` (across sessions), `$.clock`, `$.env`, `$.fs`, `$.plugin.root` |
| `types/index.d.ts` + `"types"` in `plugin.json` | declares every `$.state` value the module keeps; `claude plugin validate` holds the module to it |
| `<file>.test.ts` | a test under `claude plugin test <plugin dir>`: each `on(...)` in the test stands for the engine beneath the plugin and answers its calls |

The module runs in a sandbox of its own: no Node, no DOM, no `import()` and no file outside the
plugin. Anything outside goes through `$`. A helper the classic hook also needs is called as a
process (`$.process.run(['node', script, ...])`), not imported.

## Where this repository uses it

| plugin | module | what it does |
|---|---|---|
| `cerberus` | `hooks/push-guard.ts` | judges every `git push` in-process before it runs (`tool.call` on Bash, `$.model.complete`). A clean verdict goes into the verdict cache that the classic hook reads; findings off the whitelist are handed to the classic hook (`push-range.mjs flag`), which asks the person about exactly those (RMA-411). `hooks/check-version.sh` prints a red notice at session start on Claude Code older than 2.1.292, which cannot load the module |

The classic hook stays the floor. Anything the module cannot decide falls through to it, so a
Claude Code build that stops loading the module loses the in-process judge and keeps the guard.

## Who reads and writes what

| reader / writer | reads | writes |
|---|---|---|
| Claude Code at session start and after `/reload-plugins` | `hooks.json` `modules`, the module, its `types` | nothing |
| `claude plugin validate <dir>` | the manifest and the module's source, as the engine reads them | nothing; reports every hook and call the module makes and anything the engine would refuse |
| `claude plugin test <dir>` | `*.test.ts` and `*.test.tsx` beside the module | nothing |
| a module's `$.state` / `$.store` | the values its `types` declare | the same values; `$.state` lasts the session, `$.store` survives sessions. Module variables start over on every reload |

## What blocks and what warns

- `claude plugin validate` **fails** on a `$.state` key missing from the contract, and on a `$`
  passed to anything but a function declared at the top of the module. It only **warns** about a
  missing licence or icon; those are rules of Anthropic's plugin directory, not of loading.
- A hook that throws is skipped alone and nothing else stops. A session that hot-reloads the plugin
  folder shows one dim line naming the plugin, the event and the reason; any other session writes
  it to the debug log only.
- Mod tests run only where Claude Code is installed. CI runs the classic hooks' suites
  (`cerberus-tests.yml`), not `claude plugin test`.

## How You should know is built

The built-in `cc-plugin-you-should-know` (off by default, `/plugin enable
cc-plugin-you-should-know@builtin`) is the reference for a band above the prompt. Read from the
2.1.309 binary:

- **Hooks:** `prompt.submit`, `command.run`, `turn.step`, `ui.render`, `session.detach`,
  `session.end`. **Calls:** `model.fork`, `prompt.fill`, `prompt.read`, `ui.toast`, `state.*`,
  `store.*`, `clock.after`.
- **When it looks:** every 6 model steps (`CHECK_EVERY` = 6). A side agent
  runs through `$.model.fork`: the main thread's own transcript, every tool denied, with a prompt
  that defaults to suggesting nothing.
- **What it draws:** a `ui.render` hook on `{ component: 'AbovePrompt' }`: `✦ Heads up · <line>`
  (or `You should know`), then the choices `1: Learn more  2: Knew this already  0: Dismiss`. A
  bare digit in an empty prompt box presses a choice.
- **`1`:** a second fork writes an explanation; the card expands with `1: Understood  2: Chat in
  main session  0: Dismiss`. `2` there puts `Here is a note offered by a side agent:` and the note,
  quoted, into the prompt box (`$.prompt.fill`, mode `replace`) and the card leaves. A box that
  already holds text is left alone, with a toast.
- **Leaving:** after 2 prompts (`CLEAR_AFTER_PROMPTS`); `MAX_CARDS` is 4; a dismissed card shows a
  feedback row for 20 s (`ASKED_MS`). "Knew this already" persists the line in
  the store, so it is not offered again.
- **Language:** the line and the explanation are written in the language the user writes in; the
  choices and tags stay English.
- **Its own offer to turn it on:** shown at most 3 times (`maxLifetimeShows`), at least 10
  sessions apart (`cooldownSessions`).
