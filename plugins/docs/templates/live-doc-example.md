# Price rounding

## What it is

Every price the catalog displays is rounded to the nearest unit of the storefront's configured currency
before it reaches a template, a cart line, or an export. The rule lives in one function so every surface
rounds the same way.

## Where it is used

- `catalog/pricing/round_price` — the single function every other caller goes through.
- The product listing pages, the cart summary, and the nightly price export all call it; none of them round
  independently.

## How it behaves

Rounds half away from zero to the currency's smallest display unit — two decimal places for most currencies,
zero for a currency with no minor unit. Never rounds a price below zero, and never rounds twice: a caller
passes the raw price once and reuses the rounded result everywhere downstream.

## What obliges an update

Any change to the rounding function itself, its half-away-from-zero rule, or the set of currencies treated
as zero-decimal updates this file in the same PR.
