---
description: "Use before implementing any non-trivial piece of functionality in any stack — a drag-and-drop list, a tooltip or popover, a dialog, a date formatter, a form with validation, a debounce, a virtual list, a data table, a fetch cache, an animation, a parser — when the question is whether to write it or take it from somewhere: the codebase, the platform, a composable/hook library, or a mature package. Also use when reviewing a change that added a hand-written version of a well-known thing, or when asked \"is there a library for this\" / \"should we write our own\". NOT for reusing an in-repo React UI primitive (frontend-react:ui-primitive-reuse) and NOT for trimming an over-built design that is already ours (meta:ockham)."
---

# Reuse first

## Contract

**In:** a non-trivial piece of functionality about to be written, in any language or framework, and
the project's dependency manifest.

**Out:** a one-paragraph decision, written before the code, that names what was checked at each rung
of the ladder below and why the chosen rung won; the code then follows that decision. The checkable
expectations are in `evals/rubric.json`.

---

## The ladder

Walk it top to bottom and stop at the first rung that solves the task well. Write down the rung and
the reason, in the PR description or the issue, before writing code.

1. **The codebase.** Is it already here, under another name, in another feature, in a shared
   package of this org? Grep for the concept, not the word.
2. **The platform.** Does the framework or the browser already do it: `Intl` for dates and
   numbers, `<dialog>`, `popover`, `AbortController`, `structuredClone`, `URL`, Vue's
   `Transition`, React's `useDeferredValue`.
3. **The composable or hook library of the stack.** For a task shaped like a composable, VueUse in
   Vue and the equivalent hook collections in React. Use it directly; do not wrap a call in a
   composable of ours unless the wrapper adds business meaning.
4. **A mature library for the task.** Candidates by task are in `references/catalog.md`. They are
   directions to look in, never a required dependency list.
5. **Compare the real candidates**, two or three, on: maintenance (last release, open issues
   answered), compatibility with our versions, size and performance for our case, the TypeScript
   API, accessibility, known limits, and the cost of keeping it. Popularity alone decides nothing.
6. **Choose** the most reasonable option and say why in one line.
7. **Write our own** only when every rung above failed for a reason you can state: the task is
   specific to our domain, the libraries are abandoned or far too big for the need, or the platform
   covers it in three lines.

## The two ditches

| Do not | Do not either |
|---|---|
| reinvent what a maintained library does well | pull a 200 kB dependency for a ten-line function |
| copy a library's code into the repo without a reason | wrap every library call in a helper of ours |
| pick an outdated library because it is the one you know | build a UI framework of our own out of primitives |
| skip the ladder because the first idea was fast to type | turn a simple task into a survey of ten alternatives |

The ladder is proportionate: a debounce takes one look at the platform and the hook library and is
done; a data grid deserves the full comparison.

## Where it plugs in

The stack skills call this one at the moment they would otherwise write code: the Vue skills name
VueUse as rung 3 and the ecosystem libraries as rung 4; the React skills do the same with their
hooks. `frontend-react:ui-primitive-reuse` is the in-repo search of rung 1 for UI primitives, and it
wins when the thing being reused is one of our own components.

---

## Before you finish

1. Find the decision paragraph (PR description, issue, or a comment at the seam): it names the rung
   chosen and the rungs checked.
2. If a dependency was added: `git diff package.json` shows one package for one task, and the
   comparison names at least one alternative that lost and why.
3. If our own code was written for a task in `references/catalog.md`: the paragraph says which
   library was rejected and for which reason from rung 7. No reason, no own code.
