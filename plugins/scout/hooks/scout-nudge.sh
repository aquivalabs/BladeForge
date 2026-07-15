#!/usr/bin/env bash
# UserPromptSubmit hook: route skill/plugin/marketplace-discovery questions through scout.
#
# Emits a single conditional instruction on every prompt; the model decides whether
# the prompt actually asks "what could help / what should I use". No keyword grep —
# intent detection is the model's job, so this works in any wording or language.
# Pure stdout (cat + heredoc): no jq/grep dependency, no stdin read, mutates nothing.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"When the user asks which skills, plugins, or marketplace tools could help — or what to use for a task, in any wording or language — invoke the scout:scout skill and answer from its catalog.json (best-for, needs, changes flags, install commands), not from the in-context skill listing or from memory."}}
JSON
