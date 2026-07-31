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
- **Nudge**: a proactive prompt on Home. **Weekly Review**: the recurring review dialog.
- **Persona**: all seeded content belongs to Mai Tran, senior product designer in Ho Chi Minh City moving toward AI product work.

Prototype rules that never bend: desktop web only, mock data only, scripted AI only, no persistence, shadcn/ui as the component base.
