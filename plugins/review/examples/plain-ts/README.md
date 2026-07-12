# Example: plain TypeScript project

Minimal `.claude/review.config.json` showing how a non-Salesforce repo targets the generic review
framework:

- All 5 reviewers stay enabled at their default thresholds (only `docs` is customized here).
- `docs` pairs any change under `src/**` with a required `README.md` update.
- `EXAMPLE` is allowlisted so doc/code samples are not flagged by the secret scan.

Everything not listed falls back to `DEFAULT_CONFIG` (see `scripts/review/config.ts`).
