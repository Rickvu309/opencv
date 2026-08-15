# OpenPath

An AI career coach. Five artefacts hold the person's work. The Coach edits them through one write path.

## Language

### Product

**Artefact**:
One of the five things the person builds: Profile, Paper, Pitch, Search, Application. The Coach and the screens read and write the same artefacts.
_Avoid_: feature, module, kit, document (as the product noun)

**Coach**:
One conversation that can change artefacts on the person's behalf. The full-page view and the dock are the same thread.
_Avoid_: chatbot, assistant, agent (as a product word)

**AppState**:
Everything the Coach is allowed to see and change. Viewport, popovers, and layout width are not AppState.
_Avoid_: Redux slice, per-screen store

**applyAction**:
The one write path. A click and a Coach turn both go through it. The Coach validates and returns an envelope; the browser applies that envelope because the store lives in the tab.
_Avoid_: the Coach writes the database, the Coach mutates AppState directly

### Artefacts

**Profile**:
Who the person is: identity, context, experience, education, and vault documents.
_Avoid_: settings (the account menu holds Profile; settings is plan and billing)

**Paper**:
A document the person takes into an application. The artefact is Paper. A paper has a **type**: CV, letter, or write-up. The screen is a library of papers.
_Avoid_: Papers (as a product name, rail label, or heading), My Papers, CV (as a screen), Resume (as a product word), letter (as a second artefact)

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

### Paper vs vault

**Built paper**:
A CV-type, letter-type, or write-up paper written inside OpenPath, with content the Coach can edit.
_Avoid_: vault document, uploaded file (as if it were the same object)

**Vault document**:
A pointer on the Profile to a file or link the person keeps elsewhere. Evidence for the Coach, not a built paper. A vault CV and a built CV-type paper can both exist.
_Avoid_: Paper, Resume, the CV (as if there were only one)

### What this product is not

**Plan**:
Not a todo list. “Plan and billing” is the subscription screen.
_Avoid_: plan (as tasks), todos, weekly plan (as an artefact)
