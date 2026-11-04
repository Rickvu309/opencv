# Coach: scope, research and release requirements

Research checked 28 October 2026. Issue #377 defines this release. The Coach
helps a person improve a CV, tailor it to a saved job, prepare for interviews
and plan a job search using their workspace data.

## Product scope

The Coach page and shell panel use one chat store and turn implementation.
A new chat offers six starters and five more ideas. History groups saved chats
by date and searches their titles. A person can attach Paper documents, saved
jobs or a link, see named working steps, select an allowed mode, stop a reply,
and reopen the same conversation from Paper.

Free accounts get Free mode. Light and Max require Pro. Remaining daily turns
and reset time come from the account usage read. At the cap the composer is
disabled and links to Upgrade. Existing billing is reused.

Paper create and edit receipts link to the document and show changed blocks.
Commands that need confirmation stay pending until Approve or Decline. An
approved reversible command exposes its completed activity and Undo, including
after reload. Undo can fail when later edits invalidate a reversal; the person
can retry or edit manually. A saved partial reply stays one bubble after Stop.
Regenerate adds a text alternative without repeating workspace changes.

The Coach edits a CV or letter with `paper.edit`.
Its context holds a bounded outline of the open document (block ids, section
titles, heading levels, marks, links, nesting) and the revision to pass as
`basedOn`. A Paper context item may carry `blockIds`; the outline marks them
with `>>`. `paper.outline` reads the same outline again. The edit lands on a
fork at `basedOn` and merges into the live document, so text the person typed
meanwhile stays. A move, remove or field change on something the person
changed since `basedOn` comes back `stale` and is not applied; the Coach
re-reads and tries again. An edit with no applied op writes nothing and has no
Undo. Undo of a Coach edit takes back only its own changes and keeps later typing.
It is refused, and the activity read marks it not reversible, while a newer
Coach edit made on top of it that changed the same blocks is not undone. It is
also refused, with nothing written, when the person changed the Coach's words
since. Typing that reaches the server inside a block the Coach moved or
removed is not carried by the server; the editor will rebase it by block id
(step 5). Two Coach edits from the same read cannot
both change one block: the second comes back `stale`.

## What the implementation needs

| Area        | Existing foundation                               | Release work                                                                                   |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Contract    | Typed commands, reads and stream events           | Preserve one registry for UI and model tools.                                                  |
| Chat UI     | Shared turn reducer and shell dock                | Shared workspace, starters, history, attachments, progress and cap states.                     |
| Grounding   | Focused document and attachment resolver          | Include bounded document content, version, selected text and saved turn attachments.           |
| Mutations   | Registry permissions, pending actions, activities | Show approval state, rich results and reversal after reload.                                   |
| Reliability | SSE and usage rows                                | Forward abort, propagate provider errors, atomically admit usage and reject overlapping turns. |
| Operations  | Environment routing and local verification        | Document current routes, limits, constraints and release evidence.                             |

The domain package stays free of database and model imports. API product
modules own their tables; the registry owns command execution and activity.
Only `apps/api/src/coach` imports the AI SDK. Browser requests and invalidation
stay under `apps/web/src/lib`.

## Research decisions

The [AI SDK text generation documentation](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
provides output limits, abort signals, timeouts and streaming error parts.
A stream error must produce an error outcome, never a successful final reply.
The [tool calling documentation](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
supports bounded multi-step execution. Tools receive the authenticated actor
and execute through the existing registry. No second agent framework is needed.

Documents, job descriptions, selected text, links and recorded actions are
untrusted context. Their instructions cannot authorize commands or override
permissions. Links are references only: this release does not fetch their
contents. Paper/job reads enforce ownership. Selection and attachment IDs are
stored with the user message so regeneration can recover them after reload.
Regenerate adds an alternative response without replaying tools; earlier action receipts
and their Undo remain available. Context is bounded, so a long document can be truncated. The model must ask
for missing facts rather than invent qualifications.

[OpenRouter's Free router](https://openrouter.ai/docs/guides/routing/routers/free-router)
chooses an available free model. Its changing model choice means local fake
responses cannot establish Free model quality. [Provider rate limits](https://openrouter.ai/docs/api_reference/limits)
are separate from the app's daily cap; capacity failures must remain visible
errors. Pro uses direct Anthropic routing. The [current model overview](https://platform.claude.com/docs/en/models/overview)
should be checked with the deployment account before changing model overrides.
Exact application routes and caps are in [deployment settings](deploy.md).

[Provider logging policies](https://openrouter.ai/docs/guides/privacy/provider-logging)
vary by provider. Workspace content is sent to the selected model service;
this release does not promise zero retention or configure a new privacy policy.
Check provider settings and the product's data disclosure before a live rollout.

## Verification and rollout

The repeatable local walkthrough is
[coach-turn.md](../.claude/skills/verify-opencv/features/coach-turn.md).
It launches an isolated database and scripted runtime with no paid model call.

| Check                       | Evidence target                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SDK grounding and failure   | `apps/api/src/coach/turn.test.ts`: selected text, document version, SDK error outcome.                                            |
| Saved context               | `apps/api/src/coach/turn-admission.test.ts`: successful send followed by regeneration retains selection and attachment reference. |
| Stop                        | `apps/api/src/coach/turn-admission.test.ts`: controlled stream saves exactly one aborted partial reply.                           |
| Authorization               | `apps/api/src/coach/turn-admission.test.ts`: disabled chat saves no message; another account cannot Stop a chat.                  |
| Completed approval and Undo | `apps/api/src/chat/chat-contract.test.ts`: approve job move, reload rich receipt, undo and reload.                                |
| Panel and quota UX          | `apps/web/src/features/coach/coach-workspace.test.tsx`: New chat stays selected; cap disables sending.                            |
| Stream lifecycle            | `apps/web/src/features/coach/use-coach-turn.test.ts`: Stop/regenerate avoids duplicate reply IDs.                                 |
| Real integration            | Browser walkthrough on desktop and narrow viewport, then repository review gates.                                                 |

Before enabling live providers, run representative CV rewrite, tailoring,
interview, unsupported-claim and malicious-document prompts against each
configured route. Evaluate factual grounding, unauthorized actions, valid
versioned edits, approval requirements, useful advice and failure recovery.
Repeat tasks when changing a model; [Anthropic's evaluation guidance](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests)
recommends task-specific success criteria. These live quality evaluations are
not claimed by the scripted verification.

This release merges the implementation. Production configuration, provider
quality evaluation and deployment remain separate operations. Explicit Stop
currently assumes a single API process. The usage reservation protects quota
admission and same-chat overlap through the database; a five-minute stale
reservation window permits recovery after process loss.
