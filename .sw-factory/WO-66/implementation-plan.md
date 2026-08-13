# Implementation Plan: WO-66

**Work Order:** WO-66 - Visual polish pass: spacing, padding, shadows, alignment

## What this pass changed

- **A nested card removed.** The next-step block in the tracker was a muted
  panel inside a card, which is the nested-card read the design system rules
  out. A hairline and the panel's own ground say the same thing with less.
- **Tabular numerals** wherever numbers sit in a column: the fit read on every
  opening ("3/5" and "12/15" should line up down the list), the usage counter,
  the prices, the allowances, the deadline field, the span durations.
- **No raw hex and no off-scale spacing** on the surfaces in scope, verified by
  grep.

## What was deliberately not changed

`components/cv/resume-document.tsx` holds literal hex values, and they stay.
That component renders a CV for print and PDF: it is outside the app's theme by
design, and a printed CV that changed colour with the reader's dark-mode
preference would be a bug rather than conformance.

## The honest limit

The blueprint's "panels over cards, prefer divided lists over gapped tiles" is
the largest item in this work order and the one this pass did **not** sweep
through. Every list surface in the product (Papers, Pitch, Search,
Applications) uses the same gapped-card pattern, so the app is internally
consistent; converting all four is a visual change large enough to want a human
eye on it, and this agent has no browser to check the result with. Recorded here
rather than quietly skipped.
