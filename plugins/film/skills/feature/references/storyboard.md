# Storyboard

The storyboard is the only model the film is made from. The Director writes it, the Braintrust reviews
it, the user sees it in chat before any scene exists, and Claude Motion builds one scene per entry.

## Shape

```json
{
  "feature": "Price stack",
  "product": "Acme Market",
  "language": "en",
  "audience": "product, support and finance leads",
  "running_example": "Maya's cart: six items, a 3-for-2 bundle, coupon SPRING15, Acme Plus member, lives in Northshire",
  "palette_source": "company design system | project UI tokens | asked",
  "screens": [
    {
      "id": "stakes",
      "scene": "stakes",
      "chapter": 1,
      "kind": "failure",
      "secs": 24,
      "shows": "what moves on screen, in one or two sentences",
      "captions": ["at most 8 words each, one on screen at a time"],
      "event": "what happens, with its outcome; a showcase station lists two to four",
      "facts": [ { "claim": "...", "source": "spec §2 | code path | commit | author interview | invented" } ],
      "footnote": "plain-words source line, or the invented-example note"
    }
  ]
}
```

`scene` names the scene file that shows the screen; several screens may share one (the title usually opens the stakes scene). Every `fact` names its source. A fact whose source is `invented` needs a `footnote` on its screen.
`secs` add up to at most 300.

## Example (fictional): Acme Market, "Price stack"

| id | ch | secs | shows | event | footnote |
|---|---|---|---|---|---|
| `title` | 0 | 4 | "FEATURE BRIEFING · ACME MARKET", "Price stack", "One total for every cart, every euro explained" | — | — |
| `stakes` | 1 | 20 | Maya's cart at €84.20; checkout at €79.10 because the coupon counted twice; a week later the shop bills her the missing €5.10 | the second coupon line drops in; stamp "BILLED AGAIN" | The situation is invented for the example |
| `what` | 1 | 10 | A recipe card with six steps in a fixed order: price list, resident, membership, bundle, coupon, tax | the "frost" step tries to jump before "bake" and slides back | From the design doc |
| `who` | 3 | 8 | Shoppers, support agents who explain a total, finance who audits discounts | — | From the design doc |
| `journey` | 4 | 59 | One camera ride over six stations, rail at the top, counter "rules applied N/6" and the running total | see the stations below | Example cart; amounts invented |
| `finale` | 6–7 | 27 | Beat 1: €84.20 ≠ €79.10 → billed again, against one total everywhere. Beat 2: the test command and its output typed, a counter of test cases with the line "counted, not run". Beat 3: three problems, two topics, the invitation | the count lands with a ring | Test count counted in the test files, not run for this film |

Stations of `journey`, about 10 s each, each with its object and two to four events; a station ends at its last event, with no hold:

1. **Cart** — the real-looking cart with six lines. Event: Maya adds the third bundled item, a "3 for 2"
   badge snaps on.
2. **Region** — the price list switches from "Standard" to "Northshire". Event: two prices change,
   the total ticks.
3. **Resident and membership** — the resident badge and the Acme Plus card. Event: the subscription is
   checked ("active until 30 June") and member prices drop in.
4. **Bundle and coupon** — the coupon field. Event: SPRING15 is refused on the bundled item with its
   reason ("one discount per item"), then accepted on the other lines. Member and resident prices are prices,
   not discounts; only the bundle and the coupon count as discounts.
5. **Tax** — the Northshire rate applied last, on the discounted amount.
6. **Receipt** — every line has a "why": "−€23.90 · 3 for 2", "−€5.10 · SPRING15 (not on bundled items)".
   Event: support opens the same receipt and sees the same lines.

Finale beat 3, from the design doc's open questions:

- Problems: coupon and bundle on one item (a rule was chosen; product has not signed it off) · a
  membership that lapses during checkout · tax for delivery to another region.
- Topics: should the resident benefit stack with member prices · show the breakdown to shoppers, or
  only to support.
