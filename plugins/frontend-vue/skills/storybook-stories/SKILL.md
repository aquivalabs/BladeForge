---
description: "Use when writing, adding or asking about a Storybook story for a Vue component — \"add a story for X\", a .stories.ts file, which states a story should cover (default, empty, loading, error, disabled), how to show a component's skeleton beside it, what mock data a story uses, how a component that reads a Pinia store gets its fixture data in a story, how a story renders in the light and the dark theme — or whether a just-finished Vue component needs a story at all. Also right after creating a Vue component: on the first one in a project, explain Storybook, ask yes or no, and record the choice in CLAUDE.md. NOT for React stories (frontend-react:storybook-stories), NOT for Vitest component tests (frontend-vue:testing), and NOT for where the component itself lives (frontend-vue:component-architecture)."
---

# Storybook stories — ask once per project, then follow the recorded choice

The Vue counterpart of `frontend-react:storybook-stories`. A story is the cheapest way for a person
to see a component on its own, in every state, on the real styles. Not every project wants them, so
the choice is asked once and remembered.

## Contract

**In:** a Vue 3 project built with Vite, and a component that is new, finished, or about to get a
story.

**Out:** the `Storybook stories:` line in the project's `CLAUDE.md` honoured: on the first component
Storybook is explained, the user asked, and the answer recorded. Where the answer is `yes`, a
`stories/` folder beside the component holds `<Component>.stories.ts`, which reaches every state
through controls, and `<Component>.mock.ts`, which holds its data. The checkable expectations are in
`evals/rubric.json`.

---

## Step 1 — Read the recorded preference

Look in the project's `CLAUDE.md` for the line:

- `Storybook stories: yes` → go to step 3.
- `Storybook stories: no` → stop, write no story, and say nothing more about it.
- No line → this is the first time on this project → step 2.

Never ask again when the line exists; asking once is the point.

## Step 2 — First time: explain, ask, record

Check whether Storybook is set up: a `storybook` script or a `@storybook/vue3-vite` dependency in
`package.json`, or a `.storybook/` folder.

Explain it in the user's language, in a few lines. Storybook is a workbench where each component
renders on its own page, outside the app, with no router, backend or login. A person reviews every
state there, and the next developer finds an existing component instead of building a second one.

Ask: **"Should every new component in this project get a Storybook story?"**

If Storybook is not set up and the answer is yes, say that it needs a one-time
`npm create storybook@latest`, and ask whether to run it now. The Vue framework package is
`@storybook/vue3-vite`.

Record the answer as one exact line where the project keeps its conventions, so step 1 reads it
next time:

```text
Storybook stories: yes
```

## Step 3 — Write the story

If the repository exposes a Storybook MCP, call its `get-storybook-story-instructions` first and
follow it for imports and patterns.

- **Placement is strict.** Put a `stories/` folder beside the component, holding the story and its
  data: `features/feed/stories/FeedPanel.stories.ts` and `features/feed/stories/FeedPanel.mock.ts`.
- **Mock data always lives in its own file.** `<Component>.mock.ts` exports
  `<componentName>StorybookMock`. Never put the data inline in the story, and never import the app's
  runtime fixtures. Keep the values neutral, like "Item — rising", so a generic component keeps
  generic data.
- **Use CSF 3 with types.** `Meta<typeof FeedPanel>` and `StoryObj<typeof meta>` come from
  `@storybook/vue3`. A story that needs a wrapper uses
  `render: (args) => ({ components: { FeedPanel }, setup: () => ({ args }), template: '<FeedPanel v-bind="args" />' })`.
- **Drive states through controls, not through many exports.** Make the props that change state
  args, and expose them in `argTypes` as `select`, `radio` or `boolean`. A reviewer then reaches
  every state from the Controls panel of one story. Add a named export only for a state that
  deserves its own entry point.
- **Cover the states the component can reach:** default, empty, loading, error, and the key prop
  variations. If the project has an error-boundary component built on `onErrorCaptured`, show its
  fallback as the error state.
- **A component that reads a Pinia store gets its fixture through the store, not through props it
  does not have.** Register Pinia once in `.storybook/preview.ts` with
  `setup((app) => app.use(createPinia()))` from `@storybook/vue3`. In the story, a decorator patches
  the store from the mock file before the component renders. The code below is an example of the
  pattern, not a tested recipe: check it against the project's Storybook version on the first story
  that uses it.

  ```ts
  // Example — not yet run in a project.
  decorators: [() => ({
    setup: () => { useFeedStore().$patch(feedPanelStorybookMock.store); },
    template: '<story />',
  })],
  ```

  The patch runs inside the decorator's `setup`, where Pinia is already installed on the app.

  The mock holds the whole state slice the component reads. Each story then overwrites what the
  previous one set, and no story leaks into the next. Actions that call the network are replaced in
  the mock, never left to fire.
- **The theme is a toolbar switch, if the project has more than one.** Add a `theme` global in
  `.storybook/preview.ts` and a decorator that sets the attribute the app uses, such as
  `data-theme` on `<html>`. Every story then renders in both themes without a story of its own.
- **A colocated skeleton is a state, not a story.** If the component has a `<Component>Skeleton.vue`
  (`frontend-vue:skeleton-components`), render the skeleton directly below the real component in
  each state, the real one on top. One shared decorator does this for all states. The skeleton gets
  no story file of its own.
- Match the project's existing story conventions: imports, decorators, globals.
- After writing, give the user the preview URL of each story: the Storybook MCP `preview-stories`
  tool, or the `iframe.html?id=…` address.

---

## Before you finish

1. Read the `Storybook stories:` line in `CLAUDE.md`. If it was missing, Storybook was explained,
   the user was asked, and the answer is now recorded.
2. If `no`: no story was written.
3. If `yes`: run `npm run build-storybook` (or the project's equivalent) → it exits 0. Open each new
   story's preview URL and flip every control → every state renders, including error and loading.
4. `ls <component folder>/stories/` → the story and its `*.mock.ts`; `grep -n "mock" <story>` shows
   the data imported from the mock file, not written inline.
5. A line fails? Fix it and start again from 1.
