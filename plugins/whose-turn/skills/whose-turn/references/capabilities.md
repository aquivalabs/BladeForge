# What the monitor can do

Answer "can the monitor do X?" from this list and act with the tool or call named; do not guess. The window's blocks are Your move, Waiting on others, What changed (the feed), To do, Handled and Recently done.

| The user wants | What the monitor does | Tool or call |
|---|---|---|
| What is on me, what changed | Your move (rows ranked by urgency), Waiting on others, What changed (unread feed), Recently done | `whose_turn_summary`, `whose_turn_state` |
| To note something, or finish it | To do: personal tasks per workspace | `whose_turn_todos` |
| To bring a Handled row back | The mark and its note go, and the row is back in Your move | `whose_turn_unmark_handled` |
| To clear What changed | Every event of a workspace's feed marked read, or only some; marked unread again on request | `whose_turn_mark_read` |
| Fresh data now | Every source is checked at once instead of at the next poll | `whose_turn_refresh`, then `whose_turn_summary` |
| A newer monitor | An update is announced at session start and in the window; it installs only on the user's yes or the window's Update button | `whose_turn_update` |
| To log what was done on a row | Handled: the row leaves Your move and shows under Handled with a one-line outcome note, until something newer happens on it (7 days at most) | `whose_turn_mark_handled` |
| To know when a ticket waits for a release | A ticket whose status is Ready for release (or Ready to release, Awaiting release) is not the user's move: it waits under Waiting on others, with the next step "the next release" (Waiting for the next release). The row's `next` and `why` say so | `whose_turn_state` |
| Who still has to review a pull request | A ticket in code review lists every reviewer of its PR: the ones asked by name, and the ones who answered with approved or changes requested; the user's own review is left out | `whose_turn_state` (the row's `why`) |
| To change one workspace | Per workspace: name, id, links, look (colours, and the dotted backdrop animal: `theme.backdrop` false turns it off), sources, rules, status groups, Delete workspace | `whose_turn_config` get, edit the list, set |
| To add a workspace or a source | The same form, empty; a token goes in `secrets`, never in the config | `whose_turn_config` |
| To hide a workspace for now | Park: leaves the rail, checked every 15 minutes, comes back by itself with a dot and a feed line when something new is the user's move. Pause: leaves the rail, not checked at all, comes back only on restore. Visible: restore either. Sources, marks, to-dos and cache stay. The summary marks such a workspace with `hidden` | `whose_turn_workspace_visibility` |
| Fewer or more checks, shorter history, other warnings | Monitor settings: `poll_seconds`, `history_days`, `stale_minutes`, `failing_polls`; applied at the next poll | `whose_turn_settings` |
| No desktop popups | Notifications on or off for the whole monitor, kept after a restart (the bell in the status bar) | `whose_turn_notifications` |
| To send a bug or a wish about the monitor | A report goes to the maintainer through the relay; nothing needs connecting | `whose_turn_feedback` |
| What happened to a report | Each report has a state, the maintainer's answers and a page: `report_url`. The state is Open, "Fixed, coming in the next release" (fixed but not yet released), Done or Dropped. The window's Report button shows a dot when a report has news (a new state or answer) | `whose_turn_reports` |
| What is new in the monitor | The window's What's new: the changelog, newest first, with a dot while a version is unread | `whose_turn_whats_new` (`GET /api/changelog`) |
| Only in the window | Folding and resizing panels, the panel layout, motion (it follows the system's Reduce motion), Copy for AI. Say where it is in the window; there is no tool for it | — |
| What the user handed over from the window | Items sent with Hand to Claude arrive with the next message; they can also be read, and taken for this client | `whose_turn_inbox` |
| To see the window | App window or browser tab; the gear at the bottom of the rail opens Monitor settings, the gear in a workspace header opens that workspace's settings, the + adds a workspace | `node ${CLAUDE_PLUGIN_ROOT}/bin/app.mjs open` |

Park and pause apply to the workspace as a whole; to change one source or rule, edit the list. A workspace the user hides cannot be the last visible one: the monitor refuses it, so say so and offer another. Working hours and muting are not in the monitor yet; do not promise them. Do not answer a "can it do X?" with a yes unless a row above says so; the changelog only tells what was announced.
