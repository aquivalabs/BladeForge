# Fixture: acceptance-criteria

Expected finding: `docs-auditor` cites the mechanisms layer's own criterion — "every document under
this root names an owner and a last-reviewed date" — against `docs/mechanisms/widget-cache.md`,
which has neither field. This is not a missing-doc finding; the document exists and is declared, so
the deterministic check has nothing to say about it. This fixture exists to exercise the judgement
call the deterministic check never makes.
