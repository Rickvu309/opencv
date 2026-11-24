---
status: accepted
---

# OpenCV is rebuilt behind a spec, one context at a time

After three months the repository held four generations of the Paper document, two ways to declare an operation and a kernel that imports the products it serves. Fourteen cleanup programs had each added a new generation and left the old one standing. Only 13 of 239 api test files drove the product from outside without importing an implementation file beside them, so the tests described the code and not the product.

Each context gets a spec that outlives its code: a glossary, its operations in the contract and scenarios that run those operations from outside. The scenarios must pass on the existing code first, which is the only complete description of what OpenCV does. Then the context is built again in an empty folder from the spec alone, the operations switch over, and the old folder is deleted in the same change. There are no users and the stored data is test data, so nothing runs twice.

## Considered options

- Refactor in place: keeps every line, including the residue, and breaks implementation tests on every move.
- Rewrite everything at once: loses what the tests and guards know, gives no proof until the end and repeats the habits that produced the residue.
- Rebuild behind a spec: costs scenarios before any new code, and gives a proof at the first context.

## Consequences

- A change in behaviour changes a scenario first.
- A change that adds a new way deletes the old way in the same change.
- A reversed product decision names the code that is deleted.
- Tests run operations. A guard that reads source text needs a reason why a type, a pack rule or a scenario cannot hold its rule.
- The rich Paper editor is carried across, not rewritten.
