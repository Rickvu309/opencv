# Glossary Map

## Contexts

- [Account](./docs/product/account/GLOSSARY.md): who the person is, how they sign in and what plan they are on.
- [Control](./docs/product/control/GLOSSARY.md): how anything changes in OpenCV, and how the person stays in charge.
- [Paper](./docs/product/paper/GLOSSARY.md): the documents a person sends to get a job.
- [Apply](./docs/product/apply/GLOSSARY.md): the jobs a person is going after.
- [Inbox](./docs/product/inbox/GLOSSARY.md): recruiter mail, tied to Jobs.
- [Coach](./docs/product/coach/GLOSSARY.md): OpenCV's own agent and its conversations.
- [Agents](./docs/product/agents/GLOSSARY.md): a person's own agents, working through OpenCV.
- [Space](./docs/product/space/GLOSSARY.md): a public directory of people, companies and roles. Planned, not built.
- [Checking](./scripts/GLOSSARY.md): how a change is judged good enough to reach production: tests, guards, sweeps, probes, CI, the gate and evidence.

## Relationships

- **Control → every product context**: each context declares its commands as operation pairs, and the generated catalog binds them to Control when the app is wired. Control decides whether an actor may run one alone, records it and can undo it. Control knows actors and never a Paper or a Job.
- **Coach and Agents → the other product contexts**: an agent never writes a context's data itself. It runs the same commands a person runs.
- **Inbox → Apply**: a mail thread can suggest a Job and its next stage.
- **Apply → Paper**: a Job can link the Papers sent for it.
- **Account → every product context**: deleting an account removes the person's rows in each one.
- **Checking → the product contexts**: checks act as a person and as a stranger, and each kind's harness covers a shape of product code. Checking never borrows a product word for its own things.
- **Product words that checking does not use for itself**: Proof (a kind of Paper), Track, a screen, the Paper Loop, an activity receipt, an approval and its policy, a stale edit, a Coach run.
- **Shared**: Person, the someone a product action is for and the account a check acts as.

## Overloaded words

Each word below meant several things across or inside the contexts; use the terms named after it.

- connection: mail connection in Inbox, agent connection in Agents. Never the bare word.
- job: Role for the employer's side, Pursuit for the person's side. Job is the two together.
- profile: Profile is private. The public one is always Public profile.
- free: a Plan. A Coach mode needs another name.
- proposal, pending action, approval, confirm, action: Proposal for what waits, Approval for the person's yes.
- document, doc, page, canvas, file: Paper for the thing, Page for how it looks, Word file for what crosses the door.
- check: check, CI job, required check.
- policy: policy job, rule. An approval policy is a product word.
- proof: guard proof, flip proof. Proof is a kind of Paper.
- run: CI run, test run, walk. A Coach run is a product word.
- owner: Owner for the human, the row's person, the issue's holder, the check that covers a class.
- screen: recipe. The screen itself is a product word.
- loop: core loop run. The Paper Loop is a product idea.
- formal: formal model, Postgres test.
- harness: harness, test app.
- stale: stale model. A stale edit is a product word.
- pin: guard proof, expected failure.
- baseline, known: ratchet.
- risk: risk label, retirement class.
- review: the gate.
- green: always name the tree.

## Decisions

- System-wide decisions are recorded in [docs/adr](./docs/adr).

## Open items

- Track is in the product word list with no meaning beside it.
- The code still uses older words for several terms. A change that moves code renames it to its glossary in the same change.
