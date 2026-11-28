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
_Avoid_: worker, implementer, child, sub-agent (when the role is meant)

**Holder**:
The agent named by the newest ocv-tools claim note on an issue, which take writes. A newer release note means nobody holds it. The done command reads it.
_Avoid_: assignee (a separate GitHub field)

**Person**:
Someone who uses the product, and in checking the account a check acts as.
_Avoid_: user, owner (of a row), account holder

**Stranger**:
A second person who must find another person's row exactly as if it did not exist: not listed, not openable, not changeable.
_Avoid_: attacker (when no attack is meant), other user

### How careful a change must be

**Risk label**:
The risk (low, normal or high) declared on an issue when it is filed, as a label such as risk:normal. A change to a gate file must carry risk:high.
_Avoid_: risk class, risk level, priority

**Gate file**:
A file that decides what may merge or how checks run: ci.yml, nightly.yml, the composite actions under .github/actions, scripts/check.mjs and the main ruleset. A change to one needs the risk:high label, and then merges on green ci like any other.
_Not_: a protected check, which a change may add to freely.
_Avoid_: high-risk file, merge-deciding file

**Retirement class**:
Self or owner, recorded on each retirement. Self means a replacement test that covers the same module, command or route passed its flip proof. Owner means there is no such replacement. Both merge on green ci; the class only records how much proof stands behind the weakening.
_Avoid_: change class, strict change

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
A recurring shape of product code, today a limit or an owned row, with one interface every instance goes through and one harness that checks every instance.
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
The API started inside a test over a fresh test database, so tests reach it without a network. It lives in apps/api/src/test/harness.ts, a file name kept from before this word.
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
A read-only check of production, scripts/deploy-probe.mjs, which confirms the deployed version and opens a real imported document as a dedicated account. No workflow runs it today; it runs only by hand.
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
_Not_: the guard suite, which runs only in the guards job of ci.
_Avoid_: pre-push checks, lint step

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
A test file under an acceptance folder. A retirement can never name one. None exist today.
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
_Avoid_: gate

**CI run**:
One run of the CI workflow for one tree and one trigger: a pull request head, or a push to main.
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
Everything that must hold for a change to reach main: the required check green on its head. What must hold for a change to reach production is the main run: the full CI run on main after the merge.
_Not_: the quick checks, which save time but never decide.
_Avoid_: policy, hook, review, approval

**Green**:
The required check succeeded on a named tree. Always say which tree: green on the head (the pull request run) or green on main (the main run). Red is the opposite.
_Not_: the quick checks passing at push.
_Avoid_: passing, all tests pass, CI green (without the tree), done

**Main run**:
The CI run a push to main starts: every CI job at full scope on main as it stands after a merge. Production deploys a commit only after its main run is green.
_Not_: the merge queue, which tested the merged tree before the merge and was removed on 2026-11-24.
_Avoid_: post-merge check, full run (bare)

**Main red**:
The state after a main run fails twice: the failed jobs run again once by themselves, and the issue opens only when that second attempt fails too. An open main-red issue names the commit, and while it is open only the revert merges and nothing deploys. A green main run that contains the red commit closes the issue. The limit is 3 red runs in the last 30.
_Not_: production red, which the probe sets.
_Avoid_: broken main, red build

**Auto-merge**:
The setting under which a change merges by itself, with nobody reading it, once it is green on its head.
_Avoid_: self-merge, merge on green

### What a check leaves behind

**Verdict**:
The pass or refusal that one check or rule gives for one tree.
_Avoid_: result (bare), proof

**Evidence**:
What shows that a change works. A pull request presents it as Proof with a real command result, a screenshot, or a link to a CI run.
_Not_: a builder's own account of what it did.
_Avoid_: self-review, claims

**Risk**:
The pull request line that states what merging changes in production. A pull request with a migration names each migration and whether it only adds.

### Protecting the checks

**Protected check**:
Any test, guard, fixture, corpus file, guard proof, ratchet, limit bound, acceptance test or check configuration already on main. A change may add to it but not weaken it.
_Avoid_: frozen test, locked test

**Weakening**:
A change that makes a protected check catch less: a case or assertion removed, an expected value changed, a test skipped, a bound loosened, a ratchet grown, or a scanner dropped.
_Avoid_: loosen, relax, soften, update (for this)

**Retirement**:
The recorded, allowed weakening of a protected check, written by `ocv-tools retire` to scripts/retired/<issue>.json with why and, when there is one, a replacement test whose flip proof passed. Any builder may record one, and the pull request still merges on green ci.
_Not_: a weakening without a record, which the guards job of ci refuses.
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
_Not_: an allowed entry (permanent), an expected failure (one test), or a quarantine (temporary).
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
What a merge to main leads to: once the main run for that commit is green, production runs it, with no staging step between.
_Avoid_: release, ship, push to production

**Production red**:
The state after the probe finds production broken twice in a row. While it lasts, only the revert merges. Today it is set only when someone runs the probe by hand.
_Not_: main red, which a failed main run sets.
_Avoid_: outage, incident (for the state)

**Probe broken**:
The probe's outcome when the probe itself cannot run, such as when its session has expired. It alerts but never closes merging.
_Avoid_: flake, red, probe failure

**Revert**:
The pull request labeled production-red-revert that undoes the red commit, or the code merged since the last good version, and keeps every migration. While a main-red or production-red issue is open, only it merges.
_Avoid_: rollback

## Relationships

- A guard reads files, a test runs code, a harness runs every instance of one kind, a sweep runs every member of a derived list, a walk runs random steps through one module, and a probe reads production.
- Every check gives a verdict. Evidence shows commands with their real results, screenshots or links to CI runs.
- Rules are decided at moments. Hooks trigger the commit and push moments, the policy job decides the pull request moment, the guards job decides the guards moment, the required check needs every CI job, the gate is the required check green on the head, and the main run decides production.
- A change to a gate file needs the risk:high label, and a migration that does more than add needs its allow-migration label. Everything else merges on green ci.
- Protected checks only grow. A weakening needs a retirement, with a flip proof when it names a replacement, a ratchet only shrinks, an expected failure flips when its issue is fixed, a quarantine expires, and an allowed entry must keep matching.
- Each defect class is covered by exactly one check: the kind's harness when a kind exists, otherwise a sweep. An escape in a covered class is a defect in that check.
- When someone runs the probe, a pass changes nothing; production found broken twice means production red and a revert; a probe broken alerts and changes nothing else.
- No merge waits for anyone's yes: a pull request merges on green ci, and no agent approves its own pull request.
