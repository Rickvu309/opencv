# Checking

How OpenCV decides that a change is good enough to reach production: the tests, guards, sweeps and probes, the gate a change must pass, and what each check leaves behind. No agent reads a change before it merges, so every agent and message must use these words the same way.

## Language

### Who acts

**Owner**:
The one human who owns OpenCV and its repository. Only the owner can declare a production emergency, and every commit carries the owner's name.
_Not_: the row's person, an issue's holder, or a check that covers a defect class.
_Avoid_: operator, maintainer, project owner, the human, the user

**Coordinator**:
The agent that turns the owner's requests into issues, hands each to a builder, and resumes a builder with the first failing cases when a check goes red.
_Not_: the owner, and not a reviewer: it reads evidence, not diffs.
_Avoid_: manager, orchestrator, lead

**Builder**:
The agent that holds one issue, changes the code, verifies its own work with checks, and opens the pull request.
_Not_: the test writer, whose tests the builder may not change.
_Avoid_: worker, implementer, child, sub-agent (when the role is meant)

**Test writer**:
A second agent, separate from the builder, that writes the acceptance tests of a strict change from the issue alone, before any code exists.
_Not_: a reviewer; it never reads a diff.
_Avoid_: tester, QA agent, spec writer

**Holder**:
The agent whose claim on an issue is live, and so the only one that may save to its branch or release it.
_Avoid_: owner (of an issue or claim), assignee (a separate GitHub field)

**Person**:
Someone who uses the product, and in checking the account a check acts as.
_Avoid_: user, owner (of a row), account holder

**Stranger**:
A second person who must find another person's row exactly as if it did not exist: not listed, not openable, not changeable.
_Avoid_: attacker (when no attack is meant), other user

### How careful a change must be

**Change class**:
How careful the path to merge must be, computed by machine from what a change touches: ordinary, strict or owner class.
_Not_: the risk label, which is a prediction made before any code exists.
_Avoid_: risk class, risk level, high-risk change

**Ordinary change**:
A change that touches no strict area and no gate file. It merges by itself once green.
_Avoid_: normal change, low-risk change

**Strict change**:
A change where a mistake would refuse honest people, show one person's data to another, or lose their words: limits, sign-in, permissions, import and export, how the writing page saves, an only-adds migration, or a retirement. It needs more than green to merge.
_Not_: owner class, which identifies changes to merge rules.
_Avoid_: risky change, sensitive change, careful change

**Owner-class change**:
A change that touches a gate file, or a migration that does more than add. It merges automatically on green ci, subject to the migration allow-label rule.
_Avoid_: risk:high change, high-risk change, protected change

**Gate file**:
A file that decides what may merge or how checks run, such as the workflows, the delivery tool, the git hooks and the branch ruleset. Changing one makes a change owner class, as a classification; it still merges automatically on green ci.
_Not_: a protected check, which a change may add to freely.
_Avoid_: high-risk file, risk:high file, merge-deciding file

**Risk label**:
The risk (low, normal or high) declared on an issue when it is filed.
_Not_: the change class, which the machine computes from the diff and which wins when they disagree.
_Avoid_: risk class, priority

**Only-adds migration**:
A database migration whose every statement creates something new and changes or removes nothing that exists.
_Avoid_: safe migration, additive migration, harmless migration

### Things that check

**Check**:
Any machine judgment of a change that ends in pass or fail. Every other term in this section is a kind of check; name the one you mean.
_Not_: a CI job or the required check, which each have their own name.
_Avoid_: verification, review

**Guard**:
A check that reads the repository's own files for one known mistake, with a pure detector, a mistake fixture it fires on, a clean fixture it stays quiet on, and a guard proof.
_Not_: a test that runs product code, an ESLint rule, or a rule of the delivery tool.
_Avoid_: lint, linter, rule, policy

**Scanner**:
A check that reads every file or every entry of a folder, so a change anywhere in that folder reaches it and must run it. Scanner is a reach, not a separate kind: a guard or a coverage test can be a scanner.
_Avoid_: tree scan, covers-every-X test

**Coverage test**:
A check that every member of a set the product defines, such as its commands, routes, owned tables or page routes, has its case, entry or recipe, so a new member fails until it is covered.
_Avoid_: completeness test, enrolment test

**Kind**:
A recurring shape of product code (a limit, a view, a document session, a surface, a reader, an owned row) with one interface every instance goes through and one harness that checks every instance.
_Not_: a defect class, which a kind may cover.
_Avoid_: pattern, family, primitive, module type

**Enrolment**:
How an instance joins its kind's harness: through something a builder cannot skip, such as a type, an import or a write the database recorded, never a hand-kept list.
_Avoid_: registration, opt-in, listing

**Harness**:
The one shared check of a kind, which runs every enrolled instance against the kind's invariants.
_Not_: the test app, and not test setup or helpers.
_Avoid_: test harness (for setup), suite, framework

**Test app**:
The API started inside a test over a fresh test database, so tests reach it without a network.
_Avoid_: harness, test server, fake API

**Invariant**:
A named property that must hold for every instance of a kind, after every step of a walk, or in every state of a formal model.
_Avoid_: property, rule, assertion (for the named property)

**Walk**:
A check that drives the real logic of one stateful module through long random sequences of steps from seeds, checks invariants after each step, and shrinks a failing sequence to its shortest form.
_Not_: a sweep, which covers a derived list rather than random steps.
_Avoid_: fuzz, soak, loop, random test, simulation

**Sweep**:
A check that runs every member of a derived list, such as every recipe, every route or every Coach path, against generic pass rules, so a new member is covered without enrolment.
_Not_: a harness (one kind's invariants), a walk (random steps), or a probe (production).
_Avoid_: smoke, smoke test, scan, crawl, e2e

**Recipe**:
A named, scripted way to bring one screen state up in the local app: a route and the steps that follow it.
_Not_: the screen itself, which is a product word.
_Avoid_: screen (for the recipe), shot, scenario

**Core loop run**:
One browser run of the Paper Loop from end to end on one tree: bring a document in, open it, type, approve a Coach edit, download Word.
_Not_: the Paper Loop, which is the product idea it exercises.
_Avoid_: loop, sweep loop, smoke, e2e test

**Probe**:
A read-only check of production after a deploy, which confirms the deployed version and opens a real imported document as a dedicated account.
_Not_: a sweep, which runs on a local or CI tree, and not a health answer, which only says the process started.
_Avoid_: smoke, smoke test, canary, health check, page probe

**Formal model**:
A model of a protocol that a model checker explores exhaustively, with a clean configuration that must pass and a mutant configuration that must fail.
_Avoid_: spec, formal test, TLA (as a noun for the model)

**Stale model**:
A formal model whose mapped code changed after the model last did, so its pass no longer speaks for that code.
_Not_: a stale edit, which is a product word for an edit made on an old basis.
_Avoid_: outdated model, old model

**Postgres test**:
A test that runs against a real Postgres database instead of the in-memory test database.
_Not_: a formal model.
_Avoid_: formal test, integration test

**Quick checks**:
The fast checks run at push on the changed files: formatting, ESLint, typecheck and the comment ban.
_Not_: quick guards, the older local run of guard tests on a merged tree.
_Avoid_: pre-push checks, lint step

**Pre-check**:
The local run at push of the tests a change reaches: its changed tests, the scanners of its folders, and its nearest importers, one run at a time per machine.
_Not_: a gate verdict; it only saves a wasted CI run.
_Avoid_: check (bare), local CI, affected-tests run

### Cases and inputs

**Case**:
One concrete input or situation a check runs, with its expected outcome.
_Avoid_: scenario, example

**Case space**:
The full list of cases a change must handle, written before building: every honest use it must not block and every attack or odd input it must refuse.
_Avoid_: test plan, edge cases, happy path

**Fixture**:
A fixed input that a check reads. A guard has a mistake fixture it must fire on and a clean fixture it must stay quiet on.
_Avoid_: sample, mock data, dump

**Corpus**:
A protected collection of real-shaped files of one format, honest and hostile, that every reader of that format must handle.
_Not_: a fixture, which serves one check.
_Avoid_: samples, test files, file set

**Acceptance test**:
A test the test writer makes from the issue alone before a strict change is built. It must fail before the change, and once building starts it may only gain cases.
_Avoid_: spec test, contract test, frozen test

### The gate

**Rule**:
One row of the delivery tool's table: what an action or a change must satisfy, the moments at which it is decided, and its refusal with a fix.
_Not_: an ESLint rule, a fit rule of a sweep, or a guard.
_Avoid_: policy, gate, lint, check

**Moment**:
A point in delivery at which rules are decided, such as commit, push, opening the pull request, the pull request in CI, or merge.
_Avoid_: stage, phase, hook, step

**Hook**:
A git hook: the trigger that makes the commit and push moments run. It decides nothing by itself.
_Avoid_: gate, pre-check (for the hook)

**CI run**:
One run of the CI workflow for one tree and one trigger: a pull request head, or a group in the merge queue.
_Not_: a test run, or a Coach run, which is a product word.
_Avoid_: run (bare), build, pipeline

**CI job**:
One named job inside a CI run.
_Avoid_: check, check run, step

**Policy job**:
The CI job that decides every rule held for the pull request moment.
_Not_: the product's approval policy for commands.
_Avoid_: policy (bare), policy check

**Required check**:
The one status that must succeed for a change to merge. It succeeds only when every CI job of its run succeeded.
_Avoid_: ci (bare, in prose), status, the check

**Gate**:
Everything that must hold for a change to reach main: the required check green on its head and on its merged tree.
_Not_: the quick checks or the pre-check, which save time but never decide.
_Avoid_: policy, hook, review, approval

**Green**:
The required check succeeded on a named tree. Always say which tree: green on the head (the pull request run) or green in the queue (the merged tree). Red is the opposite.
_Not_: a pre-check pass.
_Avoid_: passing, all tests pass, CI green (without the tree), done

**Merged tree**:
The tree that results from merging a change into the current main, together with any change queued ahead of it.
_Avoid_: merge result, integration tree

**Merge queue**:
The queue that runs every CI job at full scope on each merged tree and merges only what is green there.
_Avoid_: train, merge train

**Auto-merge**:
The setting under which a change merges by itself, with nobody reading it, once it is green on its head and in the queue.
_Avoid_: self-merge, merge on green

### What a check leaves behind

**Verdict**:
The pass or refusal that one check or rule gives for one tree.
_Avoid_: result (bare), proof

**Receipt**:
A machine-written record of one check's run, bound to the tree it judged and to who produced it (CI or a local machine), with its cases, failures, repros and measured numbers. Only a check writes one, and a local receipt never satisfies the gate.
_Not_: the product's activity receipt for a command, and not anything a builder types.
_Avoid_: proof, evidence (for the record), log, report

**Pre-check pass**:
A local receipt that the pre-check passed for one head and tree. It is full, partial when a capped subset ran and CI runs the rest, or broad when the change reaches a whole suite that only CI runs.
_Not_: green.
_Avoid_: green, all tests pass, local pass

**Evidence**:
What shows that a change works: the output of the checks that ran on its head, and the section of a pull request that presents it. Any measured number in it comes from a receipt.
_Not_: a builder's own account of what it did.
_Avoid_: proof, self-review, claims

**Merge Danger**:
The part of a pull request that says what merging risks in production: each migration and whether it only adds, each limit touched, each retirement, and the change class.
_Avoid_: risk section, deploy notes

**Base comparison**:
Running the same check on the merge base and counting only the failures that are new on the change.
_Not_: a ratchet, which is committed and only shrinks.
_Avoid_: known drift, known failures, known manifest

### Protecting the checks

**Protected check**:
Any test, guard, fixture, corpus file, guard proof, ratchet, limit bound, acceptance test or check configuration already on main. A change may add to it but not weaken it.
_Avoid_: frozen test, locked test

**Weakening**:
A change that makes a protected check catch less: a case or assertion removed, an expected value changed, a test skipped, a bound loosened, a ratchet grown, or a scanner dropped.
_Avoid_: loosen, relax, soften, update (for this)

**Retirement**:
The recorded, allowed weakening of a protected check, naming why and the replacement whose flip proof passes. Any builder may propose one, and it makes the change strict.
_Not_: a weakening without a record, which the gate refuses.
_Avoid_: remove, delete, disable, drop (for the allowed act)

**Flip proof**:
Proof that a replacement test fails on the merge base and passes on the change, so it catches what it claims.
_Avoid_: proof (bare)

**Guard proof**:
A guard's record that its detector fires on a real past mistake at a named commit and stays quiet on the fix. A guard with one is proven.
_Avoid_: proof (bare), pin, historic

**Guard ledger**:
The set of guard proofs, one per guard.
_Avoid_: registry, guard list

**Ratchet**:
A committed list of known exceptions to one check, each naming its subject and an issue, that may only shrink: an entry leaves when its subject is fixed, and none may be added.
_Not_: an allowed entry (permanent), an expected failure (one test), a quarantine (temporary), or a base comparison (computed per run).
_Avoid_: known list, known reds, baseline, pending list, frozen set, waiver, allowlist

**Expected failure**:
A test kept in the suite but marked to fail because of an open bug, citing that issue. When the bug is fixed the test fails and must flip to an ordinary test.
_Not_: a skipped test.
_Avoid_: pin, known failure, xfail

**Quarantine**:
A flaky test taken out of the run for a limited time, with a tracking issue, a reason and an expiry.
_Not_: a retirement.
_Avoid_: skip, disable, mute

**Allowed entry**:
A permanent, reasoned exception inside a guard, naming the place and why the use is legitimate; it must keep matching something or be deleted.
_Not_: a ratchet entry, which waits to be fixed.
_Avoid_: exemption, waiver, ignore

**Valve**:
Any sanctioned way to pass a check without fixing what it flags, such as a ratchet entry, an allowed entry, a quarantine, an expected failure or a retirement. Every valve use shows in the evidence.
_Not_: skipping the hooks or the checks, which no agent may do.
_Avoid_: bypass, escape hatch, override

**Defect class**:
A named family of mistakes, such as a box that does not fit its window or one account starving everyone else, that one check covers.
_Avoid_: bug type, category, area

**Escape**:
A defect found after merge in a defect class that a check claims to cover.
_Avoid_: leak, miss, slip

### After merge

**Deploy**:
What a merge to main is: production runs the new main within minutes, with no staging step between.
_Avoid_: release, ship, push to production

**Production red**:
The state after the probe finds production broken twice in a row. While it lasts, the merge queue takes only the revert.
_Avoid_: outage, red main, incident (for the state)

**Probe broken**:
The probe's outcome when the probe itself cannot run, such as when its session has expired. It alerts but never closes the queue.
_Avoid_: flake, red, probe failure

**Revert**:
The pull request that undoes the code merged since the last version the probe passed, and keeps every migration.
_Avoid_: rollback

## Relationships

- A guard reads files, a test runs code, a harness runs every instance of one kind, a sweep runs every member of a derived list, a walk runs random steps through one module, and a probe reads production.
- Every check gives a verdict. A check in CI writes a receipt, and evidence and Merge Danger take numbers only from receipts. A pre-check pass is a local receipt that never decides.
- Rules are decided at moments. Hooks trigger the commit and push moments, the policy job decides the pull request moment, the required check needs every CI job, and the gate is the required check green on the head and on the merged tree.
- The machine computes the change class from the diff: a gate file or a migration that does more than add makes it owner class, a strict area or a retirement makes it strict, and anything else is ordinary. The risk label is the filer's prediction and never overrides it.
- Protected checks only grow. A weakening needs a retirement with a flip proof, a ratchet only shrinks, an expected failure flips when its issue is fixed, a quarantine expires, and an allowed entry must keep matching.
- Each defect class is covered by exactly one check: the kind's harness when a kind exists, otherwise a sweep. An escape in a covered class is a defect in that check.
- After a deploy the probe runs. A pass changes nothing; production found broken twice means production red and a revert; a probe broken alerts and changes nothing else.
- The owner says yes and the coordinator relays it; no agent ever gives it.
