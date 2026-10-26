# Remove Storybook

**Status.** Accepted. Supersedes the catalog part of ADR-0002 and the "Storybook's build joins CI" line of ADR-0010.

**Context.** Storybook was the owned kit's catalog: one story per primitive, five Foundations pages, a second Vercel project and a `build-storybook` task. The kit has one consumer, `apps/web`, and the repo no longer runs GitHub Actions, so nothing builds the catalog on a pull request. The stories, four dev dependencies and a deploy surface cost install time and review attention without guarding behaviour. The guards that matter already live in tests: `apps/web/src/test/design-vocabulary.test.ts` forbids raw hex and palette classes and raw interactive elements, `ui-kit-contract.test.ts` derives the kit surface from the directory, and `ui-kit-styled.test.ts` asserts the kit classes survive the web production build.

**Decision.** Delete every `*.stories.tsx`, `packages/ui/.storybook/`, `packages/ui/vercel.json`, the catalog test, the Storybook scripts and turbo task, and the four Storybook dev dependencies. The kit stays as source in `packages/ui`, absorbed with the shadcn CLI under the ADR-0002 rule, and is exercised through `apps/web`. The ADR-0010 vocabulary governance is unchanged.

**Consequences.** No visual catalog or Foundations pages; the kit is reviewed in the running web app. The `openpath-storybook` Vercel project and its alias are no longer deployed from this repo and can be deleted by hand. New kit components no longer ship a story; a branch that adds one must drop it at rebase.
