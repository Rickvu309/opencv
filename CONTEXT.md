# OpenPath

Personalised AI career coaching for Vietnamese early-career users, where the Coach can act in the product through the same actions the user can.

## Language

**User**:
A Vietnamese early-career person (student or new graduate) using OpenPath for themselves.
_Avoid_: Customer, client, account (for the person)

**Coach**:
The in-product AI mentor that can take product actions on the user's behalf.
_Avoid_: Bot, chatbot, assistant (for this role)

**Command**:
A named product action that changes state, available to the user and (when allowed) to the Coach.
_Avoid_: API call, mutation, tool (when you mean the product action)

**Profile**:
The user's structured self-description that coaching and features read from.
_Avoid_: Settings, account

**Paper**:
The user's CV and related application documents as product artifacts.
_Avoid_: Document (too vague)

**Pitch**:
A personal branding kit: profile-ready copy (including LinkedIn-oriented fields and other socials) and social **post drafts**. Drafts only — OpenPath does not publish for the User.
_Avoid_: Script, content calendar, scheduler

**Opportunity**:
A job or internship the User saved (form or pasted text/URL). URL paste may use best-effort fetch; if fetch fails, the User pastes the text.
_Avoid_: Opening, job (ambiguous), listing

**Search**:
Discovery of Opportunities at scale (browse/find). Out of scope for now; Users bring Opportunities in themselves.
_Avoid_: Job board (as the product)

**Apply**:
Tracking pursuit of an Opportunity (status, materials, next step).
_Avoid_: Application (unless we promote that as the record name later)
