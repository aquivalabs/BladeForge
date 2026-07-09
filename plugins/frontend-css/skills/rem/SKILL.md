---
description: "CSS Units \u2014 enforce rem for CSS/SCSS/Tailwind dimensions. Use whenever a hardcoded pixel length appears in a stylesheet or component's layout \u2014 spacing, sizing, or typography such as gap, padding, margin, width, height, or font-size \u2014 and the user wants it changed, reviewed, made consistent with a spacing scale, or made responsive to browser zoom/font-size. Applies whether the value is stated as px, an arbitrary Tailwind value like p-[10px], or an SCSS property. Do NOT trigger for genuinely pixel-appropriate values that stay in px: border-width, box-shadow offsets, or SVG attributes like width, height, and stroke-width on chart/vector elements."
---

# CSS Units — Always Use rem

## When to Activate

This is a passive rule that applies whenever writing or reviewing CSS, Tailwind, or inline styles.

## Rule

**Always use `rem` for all dimensional values in CSS and Tailwind.**

Use `px` only where `rem` is technically not appropriate:
- `border-width` (e.g. `1px`, `2px` hairlines and borders)
- `border-radius` values that must be truly pixel-precise (e.g. `1px` sharp corners)
- `box-shadow` offsets and blur radii
- SVG attributes (`width`, `height`, `stroke-width` on SVG elements)
- `letter-spacing` in very fine-grained cases where rem rounding causes visible drift
- Third-party component overrides that only accept px

## Conversion Reference (base 16px)

| px   | rem       |
|------|-----------|
| 1    | 0.0625rem |
| 2    | 0.125rem  |
| 4    | 0.25rem   |
| 6    | 0.375rem  |
| 8    | 0.5rem    |
| 10   | 0.625rem  |
| 12   | 0.75rem   |
| 14   | 0.875rem  |
| 16   | 1rem      |
| 18   | 1.125rem  |
| 20   | 1.25rem   |
| 24   | 1.5rem    |
| 28   | 1.75rem   |
| 32   | 2rem      |
| 40   | 2.5rem    |
| 48   | 3rem      |

## Why

rem scales with the user's root font size preference, making the UI accessible and responsive to browser-level zoom/font-size settings. px is absolute and ignores user preferences.

## Tailwind Note

Tailwind's spacing scale is already rem-based. Prefer Tailwind utility classes (`p-2`, `text-sm`, `gap-4`) over arbitrary values (`p-[8px]`). When Tailwind doesn't have the exact value, use arbitrary rem: `p-[0.625rem]`, not `p-[10px]`.
