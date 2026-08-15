# OpenPath

An AI career coach. Five features besides the Coach: Profile, Paper, Pitch, Search, Application. The Coach edits them through one write path.

## Language

### Product

**Feature**:
One of the five parts of the product: Profile, Paper, Pitch, Search, Application. In code, a module. The Coach and the screens read and write the same ones.
_Avoid_: artefact, artifact, kit, document (as the grouping noun)

**Coach**:
One conversation that can change any of the five features on the person's behalf. The full-page view and the dock are the same thread.
_Avoid_: chatbot, assistant, agent (as a product word)

**AppState**:
Everything the Coach is allowed to see and change. Viewport, popovers, and layout width are not AppState.
_Avoid_: Redux slice, per-screen store

**applyAction**:
The one write path. A click and a Coach turn both go through it. The Coach validates and returns an envelope; the browser applies that envelope because the store lives in the tab.
_Avoid_: the Coach writes the database, the Coach mutates AppState directly

### Features

**Profile**:
Who the person is: identity, context, experience, education, and vault documents.
_Avoid_: settings (the account menu holds Profile; settings is plan and billing)

**Paper**:
A document the person takes into an application. Paper is the feature. A paper has a **type**: CV, cover letter, or Proof. The screen is My Paper: Drive, then Docs.
_Avoid_: Papers (as a product name, rail label, or heading), My Papers, CV (as a screen), letter (as a second feature), write-up (retired; Proof replaced it)

**Drive**:
The list mode of My Paper: built papers, uploaded files, and the create doors. Type is chosen here, before a paper opens.
_Avoid_: library (as a screen), Documents, Drive as a rail label or heading

**Docs**:
The opened mode of My Paper: one paper and its chrome. Application and Coach open this. Not the documentation tree.
_Avoid_: editor, CV screen, Docs as the `docs/` folder

**CV / Resume**:
One structured paper type; the word follows the template's audience. Vietnamese employer, internship, academic, service, and one-page templates say CV. Abroad/ATS, technical, and design templates say Resume. Changing the template changes the word.
_Avoid_: Resume (on a Vietnam-facing paper), CV and Resume (as two separate types)

**Proof**:
A paper type for work that is not yet a story: a running dump of notes, photos, and links about a project, experiment, or shift. Arrange then Publish puts it on a designed share page; published Proofs collect on one personal link. Its content can be reused on a CV. Never required, never auto-inserted.
_Avoid_: brag document, journal, wins, evidence locker, write-up

**Pitch**:
How the person describes themselves: bio, self-introduction, interview answers. Lines to reuse, not a document they export.
_Avoid_: paper (Pitch is not a type of Paper)

**Search**:
Where the person looks at openings ranked against the Profile.
_Avoid_: jobs board, career map (as the screen)

**Opening**:
A real posting this person found, pasted, or saved. It belongs to them.
_Avoid_: catalogue role, PathNode, job (as the stored thing)

**Catalogue role**:
A shared role archetype. The same list for everybody, used to talk about fit. Not an Opening.
_Avoid_: Opening, job posting

**Application**:
The record of applying to an opening. Status is a verb the person takes.
_Avoid_: Opening (an application outlives the posting)

### Built, uploaded, vault

**Built paper**:
A CV-type, cover-letter-type, or Proof paper written inside OpenPath, with content the Coach can edit.
_Avoid_: vault document, uploaded file (as if it were the same object)

**Uploaded file**:
A CV or cover-letter file the person brought with them, kept as a row in My Paper. Preview and send it; you cannot type in it, and OpenPath does not parse it until extract is real. Starting a built CV from an upload does not turn the file into a paper. It does not count as a built CV.
_Avoid_: built paper, vault document

**Vault document**:
A pointer on the Profile to something kept elsewhere: LinkedIn, GitHub, portfolio. Evidence for the Coach, not a paper. CV and cover-letter files are not vault documents; they live in My Paper.
_Avoid_: Paper, Resume, the CV (as if there were only one)

### What this product is not

**Plan**:
Not a todo list. “Plan and billing” is the subscription screen.
_Avoid_: plan (as tasks), todos, weekly plan (as a sixth feature)
