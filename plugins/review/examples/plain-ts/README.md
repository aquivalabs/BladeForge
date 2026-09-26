# Example: plain TypeScript project

Minimal `.claude/review.config.json` showing how a non-Salesforce repo targets the generic review
framework:

- The five default reviewers stay enabled at their default thresholds (only `docs` is customized here); `skill`, `leak` and `security-scan` stay off, as this example repo publishes no skills.
- `docs` pairs any change under `src/**` with a required `README.md` update.
- `EXAMPLE` is allowlisted so doc/code samples are not flagged by the secret scan.

Everything not listed falls back to `DEFAULT_CONFIG` in the published `bladeforge-review-harness` package.
