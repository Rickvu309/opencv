# OpenPath domain language

Shared vocabulary for the OpenPath prototype. Use these exact terms in UI copy, code, tickets, and commits. Full design: docs/architecture.md.

- **Opportunity**: a job or role the user tracks. Never "job", "application", or "lead" in code or UI labels. Statuses: Saved, Applied, Interview, Offer, Closed. **Dream** is a flag on an opportunity, not a status.
- **Fit**: the AI's judgment of match between the user and an opportunity. Levels: Strong, Medium, Weak, Unknown.
- **Copilot**: the single embedded AI. It appears as the right panel, as inline insight blocks, and as proactive nudges. There is only one Copilot, not several assistants.
- **Trust boundary**: the Copilot drafts and suggests, the user accepts, edits, or dismisses. Nothing applies itself.
- **Insight**: one scripted Copilot output block attached to an object (summary, credibility, fit, tailoring, gap).
- **Next action**: a suggested concrete step on an opportunity. States: suggested, accepted, done, dismissed.
- **Track record entry**: one confirmed piece of professional evidence in the user's long-term memory. An unconfirmed one is a **candidate**.
- **CV version**: one named CV. A **tailored** version is linked to a specific opportunity.
- **Career memory**: the group of surfaces that persist beyond any application: Profile, CV Versions, Track Record.
- **Direction**: the group of forward-looking surfaces: Goals, Skills & Learning.
- **Nudge**: a proactive prompt on Home. **Rewind**: the recurring connected weekly review, a full route at /rewind, not a dialog.
- **Persona**: all seeded content belongs to Mai Tran, senior product designer in Ho Chi Minh City moving toward AI product work.

Prototype rules that never bend: desktop web only, mock data only, scripted AI only, no persistence, shadcn/ui as the component base.

## Recruiter mode (RDS-988)

A second, distinct persona mode at `/recruiter/*`, sharing the design system and shell primitives above but never a reskin of the candidate-side screens, and never sharing store state with them (`lib/store/reducers/recruiter.ts` only ever reads or writes `recruiterRoles`/`recruiterCandidates`). Reached from the candidate-side persona chip's "Switch to recruiter mode," and back the same way.

Two of these words are deliberate homonyms with terms already defined above. Recruiter mode's meaning always wins inside `/recruiter/*`; the candidate-side meaning always wins everywhere else. Every recruiter-mode type in code carries a `Recruiter` prefix (`RecruiterCandidate`, `RecruiterRole`, `RecruiterStage`) so the two can never collide as TypeScript symbols even though the seeded copy uses the plain English word.

- **Candidate** (recruiter mode): a person in the recruiter's hiring pipeline for one Role. Not the unconfirmed Track Record entry defined above.
- **Role** (recruiter mode): one open position the recruiter is hiring for, with must-haves and a location. Not an Opportunity, the same concept seen from the applicant's side.
- **Stage**: a Candidate's position in the pipeline: Sourced, Screening, Interview, Offer, Hired, Closed. Closed is reachable from any stage, not only after Hired. Not an Opportunity's Status.
- **Readiness**: Copilot's read on whether a Candidate is moving: Ready to advance, Needs review, Blocked, Stale.
- **Recruiter persona**: all recruiter-mode seeded content belongs to Lan Pham, talent lead at Saola Labs, a fictional Ho Chi Minh City product company. Mai Tran bridges the two worlds: she appears as an inbound Candidate for the Senior Product Designer Role, consistent with her own candidate-side profile.
