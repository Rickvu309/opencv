# Coach page and panel

The Coach page is `/coach`. The shell panel and Paper entry point share the
same chat store. The verification launcher uses the scripted runtime with an
isolated database, so no paid model request occurs.

## Preconditions

Launch through `scripts/launch.sh <run>` from this skill and run its doctor.
Use the printed web port and an isolated agent-browser session. Sign in using
`features/auth.md`. Record the checked HEAD and patch id with the evidence.

## Walkthrough

1. Open `/coach`. Check six starter buttons and choose More ideas; check
   that five more appear below them. Choose a starter and inspect the composer.
2. Open Add. Attach a Paper document and a saved Apply job when fixtures exist.
   Choose Paste a link. Reject a `javascript:` URL, then attach an HTTPS URL.
   Check the reference-only disclosure and remove an attachment with its chip.
3. Send `Help me prepare for a product intern interview`. Wait for
   `Prep the starred one next.` Check one user message, one Coach reply and
   the `Listed your Apply cards` receipt. Reload and check that both remain.
4. Open History. Find `Prepare for a product intern interview` in its date
   group. Search for an absent title, then search for `product` and reopen it.
5. On a Free account, inspect Free, Light · Pro and Max · Pro. Clicking a Pro
   mode opens the upgrade flow. Check the remaining-turn count refreshes.
6. Open the saved chat from the shell dock. Choose New chat and confirm the
   starter view stays selected. Open History in the panel and switch chats.
   Expand the panel and check that the selected conversation is unchanged.
7. Open Paper, create a Simple CV, save a summary and choose the editor Coach
   button. Check that the shared panel opens the focused chat. Save a screenshot.
8. Repeat the Coach view at a 390 × 844 viewport. Check that the composer,
   attachment chips, history dialog and starter buttons stay usable without
   horizontal scrolling. Save a screenshot.

## Controlled checks

The normal scripted response can finish before a Stop click reaches it. Use
`apps/api/src/coach/turn-admission.test.ts` for a controlled stream: Stop must save exactly
one aborted partial reply. The shared-hook test checks Stop followed by
Regenerate without duplicate IDs.

Use `coach-workspace.test.tsx` for a capped account: the reset time and Upgrade
link appear and both composer and Send are disabled. Use
`chat/chat-contract.test.ts` for approval, persisted rich receipt and Undo.
The SDK adapter test supplies actual SDK stream parts for error and grounding
checks. These tests complement the browser walkthrough.

## Evidence and limits

Record doctor output, screenshots, browser assertions and targeted test logs.
Do not describe the fixed demo reply as model-quality evidence. The demo lists
Apply cards; it does not edit a CV or exercise a live provider. Model accuracy,
provider availability and live edit quality require a separately configured
provider run. Clean up the run and browser session after verification.
