# package.json scripts for a Vue project

```json
{
  "scripts": {
    "prepare": "git config core.hooksPath .githooks 2>/dev/null || true",
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint .",
    "lint:style": "stylelint \"src/**/*.{vue,css,scss}\"",
    "format": "prettier --write .",
    "test": "vitest run",
    "check": "npm run typecheck && npm run lint && npm run lint:style && npm run test"
  }
}
```

`.githooks/pre-push`:

```bash
#!/usr/bin/env bash
set -e
npm run check
```

CI (GitHub Actions) runs the same `npm ci && npm run check` on every pull request; the branch
protection requires it.
