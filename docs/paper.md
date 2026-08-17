# My Paper: locked decisions

Product locks for `/paper`. The codebase map is [`CONTEXT.md`](../CONTEXT.md). Do not start a third Paper grill. Remaining work is code.

## Lookup (current truth)

Round 15 supersedes earlier rows where they conflict.

| Topic | Lock |
|---|---|
| Screen | **My Paper** (`/paper`). Not Documents, Papers, or CV. |
| IA | Drive (list) then Docs (opened paper). Paper-only. |
| Objects | Built CV / Resume (word follows template), Cover letter, Proof, Uploaded files. |
| North star | Deadline night: a CV they can send. Proof is never required. |
| Drive | Flat rows: name, type word, updated. Optional type filter. No folders, no A4 grid. |
| Write a CV | On the A4. Blocks live on the page. Not a form that paints a preview. |
| Upload | Starting point. File stays Uploaded. A built CV is a sibling. No parse yet. |
| Proof | A space. Band: Arrange then Publish. Never dump or Prepare on screen. |
| Share | `/p/:slug` is one Proof. `/u/:handle` is the personal link (span record). |
| Applications / Coach | Windows onto the same paper. Open means `/paper?id=`. Nobody types on a card or in a bubble. |
| Copy | Sentence case, second person, no exclamation marks. |

Empty list: "Start with the CV." Gallery: "Where is this CV going?" Letter: "Who is this letter for?" Empty Proof: "Log what you're making."

## The grill, in order

Historical record. The lookup above is current truth. Each row is one decision. **You chose** is the answer that locked.

### Round 1: what this work is

| Asked | You chose |
| --- | --- |
| What should this grilling lock? | Product decisions only. Visuals and code wait. |
| What is the actual problem? | Language drift, CV/Letter treated as screens, create actions duplicated, and the library disappearing when a paper opens. |
| What is in “everything related”? | You would not cut it: every surface that touches a paper. |
| What stays locked while we redesign? | ADR 0002, the glossary (no Papers / My Papers / CV-as-a-screen), `applyAction`, DESIGN craft, English sentence case, black-on-white documents. |
| Primary job in a short, anxious session? | Produce a sendable document. The library is how you pick; opening one means writing. |
| House pattern for Pitch, Search, Application? | Empties and voice can travel later. Drive-then-Docs IA does not. |

### Round 2: bar and objects

| Asked | You chose |
| --- | --- |
| Boundary of this pass? | Literally everything that touches a paper: Applications, Profile vault, Coach artifacts. |
| Which family is the bar? | Mix: Docs for “the page is the work”; Resume.io / Kickresume for form + live A4 + export; Teal for “this paper is for a job.” |
| North-star night? | Tonight’s deadline. A library of versions is a later state. |
| What objects live here? | Every document they take to an employer: CV, letter, and what became Proof. Type is chosen when creating. |
| Do the old 8-line ADRs bind? | Evidence of prior intent only. Contradict them and rewrite after we agree. |
| CV or Resume? | Hybrid. Not one word for every paper. |

### Round 3: source of truth

| Asked | You chose |
| --- | --- |
| Start at My Paper *and* decide every edge? | Decide every Paper-touching surface in this grilling: vault, tailor, Coach thumbnail, onboarding drop, Application links. |
| Hybrid CV / Resume rule? | Follows the template’s audience (later mapped across eight templates). Never a screen named CV or Resume. |
| Where do they land on deadline night? | Always the list first (Drive), then different chrome when a paper is open (Docs). Not editor-first. Not a Profile-style split. |
| Vault file vs built paper? | They share a Drive list. Then refined: uploads sit in My Paper; LinkedIn / GitHub / portfolio stay on Profile. |
| What Applications and Coach show? | Windows onto the same paper. Open always means `/paper?id=`. You also wanted to edit from those surfaces (clarified next). |
| Zero papers, deadline tonight? | One next step: build the CV you’ll send tonight. Letter and Proof are not equal doors. |

### Round 4: vault, doors, writing surface

| Asked | You chose |
| --- | --- |
| Where do uploaded files live? | One list in My Paper: built papers and uploaded CV / cover-letter files. Profile vault keeps only LinkedIn, GitHub, portfolio. |
| Edit on the Application board and in chat? | One Docs chrome. Those surfaces **open** it. Nobody types on a kanban card or in a chat bubble. Coach may still change a paper by talking. |
| Per-job paper from an Application? | Keep a master. “Tailor for this job” copies it, names it with the role, opens Docs. |
| How is the Drive organized? | Flat rows: name · type word · updated. Optional type filter. No folders, no A4 poster grid. Job grouping lives on Applications. |
| Opened writing surface? | CV: structured fields + live A4. **Later:** you edit the A4 (round 15). |

### Round 5: list contents and chrome

| Asked | You chose |
| --- | --- |
| What sits in the list? | Built CV / letter / Proof, plus uploaded CV and cover-letter files. Onboarding drop lands here, not on Profile. |
| Click an upload? | Preview / download. You cannot type in it. OpenPath does not parse it. **Later:** write doors open a built CV (round 15). The file stays preview. |
| Opened-paper header? | Back, editable title, type label, Export. No CV \| Letter tabs. No in-editor switcher. The list is how you switch. |
| Where do create doors live? | Empty list: one button, build tonight’s CV. Populated: New = CV, Cover letter, Proof, Upload. “For this opening” lives only on Application. |
| Profile CV / letter slots? | Drop them. “Build a CV” on Profile goes away. |
| Coach as a Paper door? | After a change, a live thumbnail of that paper (any type) with Open. On My Paper, Ask Coach is a quiet offer, not the empty hero. |

### Round 6: ready, score, name

| Asked | You chose |
| --- | --- |
| Only an uploaded PDF, deadline tonight? | Uploads do **not** count as ready. Primary remains “build an editable CV” (the Coach cannot tailor a PDF). |
| Profile score after vault CV/letter leave? | Profile is who you are + LinkedIn / GitHub / portfolio. CV completeness lives on the opened CV (and Coach thumbnail) only. Reweight so Profile still reads as out of 100. |
| Screen name? | **My Paper**. Not Documents, not Papers, not CV. |
| Default template / word? | They choose. Creating a CV opens a gallery, not a silent Vietnamese-standard default. |
| Completeness, Export, delete? | Completeness % only on an open CV and the Coach thumbnail, never on rows. Export is PDF via the print dialog. Duplicate / delete on the row menu; delete also in open chrome. |

### Round 7: voice and write-up

| Asked | You chose |
| --- | --- |
| When do they pick a template? | A gallery before the editor. Not three tiles only, and not a mall of 20 skins. |
| What is a write-up? | Not three STAR fields on an A4. You wanted a dump they work with the Coach, then something shareable. |
| Copy voice? | Mentor: sentence case, second person, no exclamation marks. Quiet, specific, one next step. |
| Does Drive+Docs travel? | IA stays Paper-only. Voice and empty-state jobs can travel. |
| Built row vs upload row? | Type word (CV / Resume / Cover letter / Proof) vs **Uploaded**. |

### Round 8: gallery strategy and the new noun

| Asked | You chose |
| --- | --- |
| Template strategy? | Copy the strategy, not the SKU count: a gallery of situations with a real A4 sense. Add more situations than the original three. Accent and spacing stay in the Format bar. |
| What is the dump object? | A running log that can become a sendable / shareable thing. Not a private-only brag doc. Not the old write-up letter. |
| Working name? | You rejected Project / notes / experiments as the signature word. |

### Round 9: eight situations and Proof

| Asked | You chose |
| --- | --- |
| Which situations get a template? | All eight: Vietnamese employer, internship / first role, abroad / ATS, academic / scholarship, technical, one page, design / portfolio, part-time / service work. |
| Signature name next to CV and Cover letter? | **Proof.** |
| What does Prepare produce? | A designed shareable Proof page (not the black-on-white CV). The dump stays. **Later:** band says **Arrange** then **Publish**. Never Prepare on screen (round 15). |
| Opened dump chrome? | Title, optional role / dates / link, running notes newest first. No STAR form. |

### Round 10: gallery and first Proof beat

| Asked | You chose |
| --- | --- |
| How does the gallery appear on deadline night? | All eight tiles at once. They pick from the wall. |
| What spreads? | A designed Proof page they send as a link. Not a social network. Photos allowed. |
| Empty Proof first beat? | Teach what this is, then dump. Example chips, then work with the Coach. |

### Round 11: site and no-project

| Asked | You chose |
| --- | --- |
| What is the website? | Each Proof can be a designed share page. A personal link indexes published Proofs. No feed, no follow. |
| They have never done a “side project”? | Empty Proof teaches what already counts: class project, shift, assignment, something that failed. Chip: “I don’t have one yet” suggests from the profile. Never required. Never shame. |
| Empty opened letter? | Situation first (you asked for letter templates), then the page. |

### Round 12: letters and the personal link

| Asked | You chose |
| --- | --- |
| Letter templates: look or structure? | Situation first. You then walked the matching-look back: the letter stays black-on-white. No eight letter skins. |
| GitHub-like graph on the personal link? | A calendar of days they logged a Proof. **Later:** a **span record** of published work dates, not app days (round 15). No streak, no score, no “keep it green.” |
| CV vs Resume across eight templates? | Vietnamese employer, internship, academic, service, one page → **CV**. Abroad / ATS, technical, design → **Resume**. |

### Round 13: four jobs

| Asked | You chose |
| --- | --- |
| Sound smart, be funny, look hot, look rich? | Jobs of the Proof and its site only. Never the CV. Smart = specific and defensible. Funny = human voice on a Proof. Hot = considered photos and type. Rich = quiet taste, not luxury cosplay. |
| Letter situations (first pass)? | Posted job, internship, speculative, scholarship. Then you dropped the matching look. |

### Round 14: Proof onto a CV

| Asked | You chose |
| --- | --- |
| How does a Proof get onto a CV? | Arrange then Publish puts the page on the web. “Add to CV” is a separate quiet action. Never auto-inserted. |
| Letter situations (final)? | Posted job, internship, speculative, scholarship. Then the black-on-white page. No letter skins. |

### Round 15: redesign (same day)

Visual locks are in the spec grilling section. Product locks that **supersede** earlier rows:

| Asked | You chose |
| --- | --- |
| Enough grilling? | Yes. Write the answers into `docs/paper.md` and the spec. No third Paper grill. What’s left is code. |
| Revamp Paper? | Rebuild **My Paper** in the app to match these two docs. Do not reopen Paper, Drive, Docs, CV, letter, or Proof as nouns. |
| Mix of leads? | The opened paper is the **output**. You edit the A4 / page. Resume.io / Kickresume: sheet as an object. Reject form-paints-preview. Teal only on Application. |
| How do you write a CV? | On the A4. Blocks live on the page. Not a form that paints a preview. |
| Tonight? | The user’s situation (I need a CV, I need it fast). Not a product mode we ship. |
| Upload? | Starting point. File stays **Uploaded**. A **built CV** is a sibling. Never merge. No parse until extract is real. |
| Upload doors? | Empty **I already have a file** → file + built CV, skip gallery. New → Upload → file only. **Start a CV from this** on the row. Onboarding drop → file only. Letter file → Uploaded only. |
| That A4, no extract? | Ghost starters. No Profile seed (there won’t be enough). Plain structure: name, contact, employment, education, skills. Format assigns a situation later. |
| “Dump” / “Prepare” on screen? | Never. Proof is a **space**. Band: **Arrange** then **Publish**. |
| Personal link mark? | **Span record** of published Proofs by role · dates. Not a GitHub day-grid. Not days they typed in Docs. |
| Click the file itself? | Still preview / download. That is not the write door. |

## Specs that hung off those answers

These were deferred in the grill, then filled so implementation could start.

**Eight CV templates** (tile · word · photo):

| Tile | Word | Photo |
| --- | --- | --- |
| Vietnamese employer | CV | yes |
| Internship / first role | CV | yes |
| Academic / scholarship | CV | no |
| Part-time / service work | CV | yes |
| Fits one page | CV | no |
| Abroad / ATS | Resume | no |
| Technical | Resume | no |
| Design / portfolio | Resume | no |

Design tile carries the honest warning: job portals may not parse it. Accent and density stay in the Format bar.

**Letter situations:** a posted job; an internship; a company with no posting; a scholarship. Situation seeds ghost placeholders, never real content.

**Profile reweight** after CV (18) and cover letter (10) leave the vault: facts 60 (context 18, experience 22, education 12, courses 8) + portfolio 18, LinkedIn 12, GitHub 10 = 100.

**Share:** `/p/:slug` is one Proof. `/u/:handle` is the personal link. Handle is name plus a short id, editable in Settings.

## What this is not

Not a social network. Not a 30-skin colour mall. Not parsing uploaded PDFs until extract is real. Not a fake scan. Not editing papers on the Application board. Not Drive+Docs for Pitch, Search, or Application. Never “Papers” or “My Papers.” Never dump or Prepare on screen.

## Copy that follows

Sentence case, second person, no exclamation marks. Never “Papers” or “My Papers” as a heading. Type words: CV / Resume, Cover letter, Proof, Uploaded.

Empty list: “Start with the CV.” Gallery: “Where is this CV going?” Letter chooser: “Who is this letter for?” Empty Proof: “Log what you're making.”
