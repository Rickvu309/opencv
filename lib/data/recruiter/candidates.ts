import type { RecruiterCandidate } from "@/lib/types";

// 12 candidates spread across the 6 pipeline stages for Saola Labs' 2 open
// roles (lib/data/recruiter/roles.ts). Mai Tran (rc-1) is the bridge into
// the existing candidate-side seed world: the same Senior Product Designer,
// Fintra background, and Ho Chi Minh City base her own /profile seed data
// already establishes, now seen from the recruiter's side as an inbound
// application. Exactly 3 candidates (rc-3, rc-5, rc-6) carry an
// attentionTemplate, the pipeline's "Needs attention" strip.
//
// RDS-989 deepens the Review, Decision, Outreach, and Submission surfaces
// (docs/architecture.md's recruiter section). 6 candidates (rc-1, rc-3,
// rc-4, rc-5, rc-6, rc-8) carry the full review anatomy (strengths,
// concerns, unknowns, open questions), context-specific outreach drafts,
// and, where eligible, a seeded hiring-manager summary draft. The other 6
// carry a believable, shorter review and fall back to
// lib/recruiter-outreach-utils.ts and lib/recruiter-submission-utils.ts for
// their outreach drafts and hiring-manager summary. Every active-stage
// candidate (Sourced through Offer) carries a seeded `decision`; Hired and
// Closed candidates need no further decision.
//
// Surface: /recruiter (board and list), /recruiter/roles (top waiting
// candidate), /recruiter/candidates, /recruiter/candidates/[id].
export const recruiterCandidates: RecruiterCandidate[] = [
  {
    id: "rc-1",
    name: "Mai Tran",
    roleId: "role-spd",
    currentTitle: "Senior Product Designer",
    currentCompany: "Fintra",
    stage: "Sourced",
    stageEnteredAt: "2026-07-30",
    readiness: "Ready to advance",
    aiSummary:
      "Nine years in product design with direct AI-explainability experience at Fintra, a strong structural match for the seller workspace's trust-and-clarity problems.",
    aiStrengths: "Nine years in product design with direct AI-explainability experience at Fintra.",
    aiWatchouts: "No prior logistics or marketplace experience, worth probing in the first screen.",
    highlights: [
      "Led the AI underwriting explainability panel at Fintra, cutting related support tickets by 22 percent",
      "Built and scaled a cross-squad design system at Loop Commerce",
      "Based in Ho Chi Minh City, no relocation needed",
    ],
    source: "Inbound",
    sourceDetail: "Applied directly through the Saola Labs careers page, citing the Solace AI explainability work in her cover note.",
    suggestedNextStep: "Schedule a portfolio screen focused on her explainability work.",
    stageHistory: [
      { id: "rc-1-sh-1", stage: "Sourced", enteredAt: "2026-07-30", note: "Applied via the careers page." },
    ],
    review: {
      status: "Not started",
      summary: "No screen scheduled yet.",
      checklist: [
        { id: "rc-1-rv-1", label: "Portfolio reviewed", done: false },
        { id: "rc-1-rv-2", label: "Recruiter screen scheduled", done: false },
        { id: "rc-1-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-1-str-1",
          point: "Nine years of product design with direct AI-explainability work at Fintra.",
          evidence: "Application: led the underwriting explainability panel, cutting related support tickets by 22 percent.",
        },
        {
          id: "rc-1-str-2",
          point: "No relocation needed, already based in Ho Chi Minh City.",
          evidence: "Application: current address and work authorization both list Ho Chi Minh City.",
        },
      ],
      concerns: [
        {
          id: "rc-1-con-1",
          point: "No prior logistics or marketplace experience on her resume.",
          evidence: "Application: both listed employers, Fintra and Loop Commerce, are fintech and e-commerce tooling, not logistics.",
        },
      ],
      unknowns: [
        {
          id: "rc-1-unk-1",
          point: "Unclear how her explainability work translates to a smaller 4-person pod.",
          evidence: "Application: Fintra's design org size isn't named in her cover note, worth asking directly.",
        },
      ],
      readinessVerdict:
        "Ready for a portfolio screen; the explainability work is a strong structural match even without direct logistics background.",
      confidence: "High",
      openQuestions: [
        "How did she structure design decisions with a small, fast-moving engineering pod at Fintra?",
        "Would the missing logistics experience need a ramp plan, or does the explainability work transfer directly?",
      ],
    },
    decision: {
      recommended: "advance",
      why: "Nine years of directly relevant AI-explainability work and no relocation friction outweigh the missing logistics background. Worth moving to a portfolio screen this week while the file is fresh.",
    },
    outreach: {
      status: "Not started",
      touches: [],
      drafts: [
        {
          id: "rc-1-draft-1",
          kind: "screening-invite",
          channel: "Email",
          purposeLine: "Invite Mai to a first screen",
          body: "Hi Mai, thanks for applying to the Senior Product Designer role at Saola Labs. Your explainability work at Fintra caught our eye, would you be open to a 20-minute intro call this week?",
        },
      ],
    },
    submission: {
      status: "Not started",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Recruiter notes"],
    },
  },
  {
    id: "rc-2",
    name: "Thu Ha Pham",
    roleId: "role-spd",
    currentTitle: "Product Designer",
    currentCompany: "Beacon Retail",
    stage: "Screening",
    stageEnteredAt: "2026-07-28",
    readiness: "Ready to advance",
    aiSummary: "Strong marketplace and seller-tooling background, the technical screen went well, ready for the panel round.",
    aiStrengths: "Deep marketplace and seller-tooling background, the technical screen passed cleanly.",
    aiWatchouts: "Only 5 years of experience against a senior bar, worth weighing scope at the panel round.",
    highlights: [
      "Redesigned Beacon Retail's seller onboarding, cutting drop-off by 18 percent",
      "5 years of experience, all in marketplace and seller tooling",
      "Comfortable presenting directly to engineering leads",
    ],
    source: "Sourced",
    sourceDetail: "Found through a targeted search for marketplace seller-tooling designers.",
    suggestedNextStep: "Move to Interview and schedule the panel round.",
    stageHistory: [
      { id: "rc-2-sh-1", stage: "Sourced", enteredAt: "2026-07-20" },
      { id: "rc-2-sh-2", stage: "Screening", enteredAt: "2026-07-28", note: "Passed the portfolio screen." },
    ],
    review: {
      status: "Complete",
      summary: "Portfolio and recruiter screen both passed cleanly.",
      checklist: [
        { id: "rc-2-rv-1", label: "Portfolio reviewed", done: true },
        { id: "rc-2-rv-2", label: "Recruiter screen completed", done: true },
        { id: "rc-2-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-2-str-1",
          point: "Deep marketplace and seller-tooling background, technical screen passed cleanly.",
          evidence: "Screen notes: passed the technical screen July 21st without flags.",
        },
      ],
      concerns: [
        {
          id: "rc-2-con-1",
          point: "Only 5 years of experience against a senior bar.",
          evidence: "Application: total experience listed as 5 years across 2 roles.",
        },
      ],
      unknowns: [],
      readinessVerdict: "Clean file, ready for the panel round; scope is the only thing worth watching.",
      confidence: "High",
      openQuestions: [],
    },
    decision: {
      recommended: "advance",
      why: "The technical screen passed cleanly and her marketplace background matches the role's core problem directly. Ready for the panel round.",
    },
    outreach: {
      status: "Responded",
      touches: [{ id: "rc-2-ot-1", channel: "Email", sentAt: "2026-07-21", summary: "Sent the screening invite.", responded: true }],
    },
    submission: {
      status: "Not started",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Recruiter notes"],
    },
  },
  {
    id: "rc-3",
    name: "Elena Kowalski",
    roleId: "role-spd",
    currentTitle: "Senior UX Designer",
    currentCompany: "Delta Freight Co.",
    stage: "Screening",
    stageEnteredAt: "2026-07-23",
    readiness: "Needs review",
    aiSummary: "Strong logistics-UX portfolio, but the technical screen still isn't booked well into Screening, the file is going cold.",
    aiStrengths: "7 years of logistics UX with a strong internal referral behind her.",
    aiWatchouts: "9 days into Screening with no technical screen booked, the file is going cold.",
    highlights: [
      "7 years in logistics and operations UX",
      "Referred by a current Saola Labs engineer she worked with previously",
      "Strong async communicator based on her application notes",
    ],
    source: "Referral",
    sourceDetail: "Referred by a Saola Labs engineer, a former colleague.",
    suggestedNextStep: "Book the technical screen this week before the referral goes cold.",
    stageHistory: [
      { id: "rc-3-sh-1", stage: "Sourced", enteredAt: "2026-07-18" },
      { id: "rc-3-sh-2", stage: "Screening", enteredAt: "2026-07-23", note: "Portfolio review passed." },
    ],
    review: {
      status: "In progress",
      summary: "Portfolio passed; the technical screen still needs booking.",
      checklist: [
        { id: "rc-3-rv-1", label: "Portfolio reviewed", done: true },
        { id: "rc-3-rv-2", label: "Technical screen scheduled", done: false },
        { id: "rc-3-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-3-str-1",
          point: "7 years of logistics UX, directly on-target for the role's core problem.",
          evidence: "Application: led operations UX at Delta Freight Co. for the past 4 years.",
        },
        {
          id: "rc-3-str-2",
          point: "Warm internal referral from a current Saola Labs engineer.",
          evidence: "Referral note: a former colleague vouched for her async communication and ownership.",
        },
      ],
      concerns: [
        {
          id: "rc-3-con-1",
          point: "9 days into Screening with no technical screen booked yet.",
          evidence: "Pipeline log: portfolio review passed July 23rd, no screen scheduled since.",
        },
      ],
      unknowns: [
        {
          id: "rc-3-unk-1",
          point: "Hasn't confirmed she's still actively interviewing elsewhere.",
          evidence: "Screen notes: no update since the scheduling link went out July 24th.",
        },
      ],
      readinessVerdict:
        "Strong on paper, but the file is going cold; the technical screen needs to happen this week or the referral relationship takes the hit.",
      confidence: "Medium",
      openQuestions: [
        "Is she still actively interviewing, or has interest cooled since the referral came in?",
        "Does her logistics UX experience extend to marketplace-style two-sided workflows, or only internal ops tooling?",
      ],
    },
    decision: {
      recommended: "request-info",
      why: "Portfolio's strong and the referral is real, but the technical screen still isn't booked 9 days in. Get it scheduled before the referral goes cold.",
    },
    outreach: {
      status: "Awaiting reply",
      touches: [
        { id: "rc-3-ot-1", channel: "Email", sentAt: "2026-07-24", summary: "Sent the screening scheduling link.", responded: false },
      ],
      drafts: [
        {
          id: "rc-3-draft-1",
          kind: "interview-scheduling",
          channel: "Email",
          purposeLine: "Re-send the technical screen scheduling link",
          body: "Hi Elena, following up on the screening link from last week, happy to find a time that works better if the original slots didn't fit.",
        },
        {
          id: "rc-3-draft-2",
          kind: "hiring-manager-nudge",
          channel: "Internal note",
          purposeLine: "Flag the referral risk to the team",
          body: "Heads up, Elena Kowalski (referred by our own team) is 9 days into Screening with no technical screen booked. Worth prioritizing this week before the referral goes cold.",
        },
      ],
    },
    submission: {
      status: "Not started",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Recruiter notes"],
    },
    flaggedForReview: true,
    attentionTemplate: "Stale {days} days in Screening: the technical screen still hasn't been booked, and the referral is starting to go cold.",
  },
  {
    id: "rc-4",
    name: "Bao Le",
    roleId: "role-spd",
    currentTitle: "Product Designer",
    currentCompany: "Vireo Health",
    stage: "Interview",
    stageEnteredAt: "2026-07-26",
    readiness: "Needs review",
    aiSummary: "Panel round split: strong on craft, the team wants a second opinion on leadership scope before moving further.",
    aiStrengths: "Panel praised his systems thinking on a genuinely complex workspace problem.",
    aiWatchouts: "One panelist flagged thin evidence of managing up to executives.",
    highlights: [
      "6 years, most recently leading a 2-person design pod",
      "Panel feedback praised his systems thinking",
      "One panelist flagged thin evidence of managing up to executives",
    ],
    source: "Inbound",
    sourceDetail: "Applied directly through the Saola Labs careers page.",
    suggestedNextStep: "Loop in the Head of Product for a tie-breaking conversation.",
    stageHistory: [
      { id: "rc-4-sh-1", stage: "Sourced", enteredAt: "2026-07-10" },
      { id: "rc-4-sh-2", stage: "Screening", enteredAt: "2026-07-16" },
      { id: "rc-4-sh-3", stage: "Interview", enteredAt: "2026-07-26", note: "Panel round scheduled." },
    ],
    review: {
      status: "In progress",
      summary: "Panel feedback is in, mixed on leadership scope.",
      checklist: [
        { id: "rc-4-rv-1", label: "Portfolio reviewed", done: true },
        { id: "rc-4-rv-2", label: "Technical screen completed", done: true },
        { id: "rc-4-rv-3", label: "Panel feedback collected", done: true },
      ],
      strengths: [
        {
          id: "rc-4-str-1",
          point: "Panel praised his systems thinking on a genuinely complex workspace problem.",
          evidence: "Panel feedback: unanimous on craft and problem framing.",
        },
        {
          id: "rc-4-str-2",
          point: "6 years including recently leading a 2-person design pod.",
          evidence: "Application: most recent role at Vireo Health lists direct reports.",
        },
      ],
      concerns: [
        {
          id: "rc-4-con-1",
          point: "One panelist flagged thin evidence of managing up to executives.",
          evidence: "Panel feedback: specific note from the engineering lead panelist.",
        },
      ],
      unknowns: [
        {
          id: "rc-4-unk-1",
          point: "Unclear whether the executive-facing gap is a coaching opportunity or a real ceiling.",
          evidence: "Panel feedback: the flag wasn't elaborated on beyond one line.",
        },
      ],
      readinessVerdict: "Split panel on leadership scope, strong everywhere else; needs a tie-breaking read before moving further.",
      confidence: "Medium",
      openQuestions: ["Does the Head of Product read the managing-up gap as coachable or as a genuine ceiling for this role?"],
    },
    decision: {
      recommended: "request-info",
      why: "Panel loved his systems thinking but split on leadership scope. A short conversation with the Head of Product should settle it either way.",
    },
    outreach: {
      status: "Responded",
      touches: [{ id: "rc-4-ot-1", channel: "Phone", sentAt: "2026-07-25", summary: "Confirmed panel logistics by phone.", responded: true }],
      drafts: [
        {
          id: "rc-4-draft-1",
          kind: "hiring-manager-nudge",
          channel: "Internal note",
          purposeLine: "Ask An Vo Thi for a tie-breaking read",
          body: "An, the panel split on Bao Le: strong systems thinking, but one panelist flagged thin evidence of managing up. Could you take a quick look at his panel notes and give a tie-breaking read on leadership scope?",
        },
        {
          id: "rc-4-draft-2",
          kind: "interview-scheduling",
          channel: "Email",
          purposeLine: "Update Bao on timing",
          body: "Hi Bao, thanks for the panel round today, we'll follow up by early next week with next steps.",
        },
      ],
    },
    submission: {
      status: "Packet in progress",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Panel feedback summary"],
      targetDate: "2026-08-08",
      draftSummary: {
        recommendation: "Move forward pending a tie-breaking read from the Head of Product on leadership scope.",
        evidence: "Panel praised his systems thinking on a genuinely complex workspace problem; 6 years including recently leading a 2-person pod.",
        risk: "One panelist flagged thin evidence of managing up to executives, still unresolved.",
      },
    },
  },
  {
    id: "rc-5",
    name: "Ngoc Anh Vu",
    roleId: "role-spd",
    currentTitle: "Product Designer",
    currentCompany: "Halcyon Studio",
    stage: "Interview",
    stageEnteredAt: "2026-07-20",
    readiness: "Blocked",
    aiSummary:
      "The panel is ready, but the case-study update she promised still hasn't arrived, the interview can't be scheduled without it.",
    aiStrengths: "8 years of B2B workspace depth, sourced directly off a strong conference talk.",
    aiWatchouts: "The panel can't be scheduled until her updated case-study deck arrives.",
    highlights: [
      "8 years, deep expertise in B2B workspace design",
      "Sourced directly after her conference talk on operational UX",
      "Panel is eager to meet her once the updated deck lands",
    ],
    source: "Sourced",
    sourceDetail: "Sourced directly after seeing her talk at a Ho Chi Minh City product design meetup.",
    suggestedNextStep: "Send one more nudge for the updated case study, or offer to run the panel off her existing deck.",
    stageHistory: [
      { id: "rc-5-sh-1", stage: "Sourced", enteredAt: "2026-07-05" },
      { id: "rc-5-sh-2", stage: "Screening", enteredAt: "2026-07-12" },
      {
        id: "rc-5-sh-3",
        stage: "Interview",
        enteredAt: "2026-07-20",
        note: "Waiting on an updated case-study deck before scheduling the panel.",
      },
    ],
    review: {
      status: "In progress",
      summary: "Waiting on her updated case study before the panel can be booked.",
      checklist: [
        { id: "rc-5-rv-1", label: "Portfolio reviewed", done: true },
        { id: "rc-5-rv-2", label: "Technical screen completed", done: true },
        { id: "rc-5-rv-3", label: "Panel scheduled", done: false },
      ],
      strengths: [
        {
          id: "rc-5-str-1",
          point: "8 years of deep B2B workspace design expertise.",
          evidence: "Application: portfolio centers on 3 B2B operational tools shipped end to end.",
        },
        {
          id: "rc-5-str-2",
          point: "Sourced directly off a strong conference talk on operational UX.",
          evidence: "Sourcing note: talk recording reviewed before outreach.",
        },
      ],
      concerns: [
        {
          id: "rc-5-con-1",
          point: "Panel can't be scheduled until her case-study deck is updated.",
          evidence: "Outreach log: asked July 21st and nudged again July 27th, no deck yet.",
        },
      ],
      unknowns: [
        {
          id: "rc-5-unk-1",
          point: "Unclear whether the delay is bandwidth or cooling interest.",
          evidence: "Outreach log: no response to either the initial ask or the LinkedIn nudge.",
        },
      ],
      readinessVerdict:
        "Genuinely blocked, not stalled by choice; nothing to decide until the updated deck lands or she confirms running the panel off the current one.",
      confidence: "Medium",
      openQuestions: ["Is the delay a bandwidth problem, or has her interest cooled since sourcing?"],
    },
    decision: {
      recommended: "hold",
      why: "The panel is ready to go the moment her updated case study lands. Nothing to decide until then, worth one more nudge first.",
    },
    outreach: {
      status: "Awaiting reply",
      touches: [
        { id: "rc-5-ot-1", channel: "Email", sentAt: "2026-07-21", summary: "Asked for the updated case-study deck.", responded: false },
        { id: "rc-5-ot-2", channel: "LinkedIn", sentAt: "2026-07-27", summary: "Sent a friendly nudge on LinkedIn.", responded: false },
      ],
      drafts: [
        {
          id: "rc-5-draft-1",
          kind: "interview-scheduling",
          channel: "Email",
          purposeLine: "Offer to run the panel off her current deck",
          body: "Hi Ngoc Anh, checking in on the updated case study, happy to run the panel off your current deck if that's easier.",
        },
      ],
    },
    submission: {
      status: "Not started",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Recruiter notes"],
      draftSummary: {
        recommendation: "Hold until her updated case-study deck arrives, or offer to run the panel off her current deck.",
        evidence: "8 years of deep B2B workspace design expertise, sourced directly off a strong conference talk.",
        risk: "Blocked on her response for over a week; unclear if it's bandwidth or cooling interest.",
      },
    },
    flaggedForReview: true,
    hold: {
      reason: "Waiting on her updated case-study deck before the panel can be scheduled.",
      since: "2026-07-27",
    },
    attentionTemplate:
      "Blocked in Interview for {days} days: still waiting on her updated case-study deck before the panel can be scheduled.",
  },
  {
    id: "rc-6",
    name: "Marcus Johnson",
    roleId: "role-spd",
    currentTitle: "Staff Product Designer",
    currentCompany: "Anchor Freight Systems",
    stage: "Offer",
    stageEnteredAt: "2026-07-29",
    readiness: "Ready to advance",
    aiSummary: "Offer sent with a Friday deadline, he's gone quiet since the call that confirmed he received it.",
    aiStrengths: "Staff-level scope today, compensation already agreed verbally before the offer went out.",
    aiWatchouts: "Gone quiet since confirming he received the offer, Friday's deadline is close.",
    highlights: [
      "10 years, staff-level scope at his current company",
      "Referred by An Vo Thi's former manager",
      "Compensation already agreed verbally before the offer went out",
    ],
    source: "Referral",
    sourceDetail: "Referred by An Vo Thi's former manager at a previous company.",
    suggestedNextStep: "Check in before Friday's deadline, offer a short call if he has open questions.",
    stageHistory: [
      { id: "rc-6-sh-1", stage: "Sourced", enteredAt: "2026-06-20" },
      { id: "rc-6-sh-2", stage: "Screening", enteredAt: "2026-06-28" },
      { id: "rc-6-sh-3", stage: "Interview", enteredAt: "2026-07-10" },
      { id: "rc-6-sh-4", stage: "Offer", enteredAt: "2026-07-29", note: "Offer sent, response due Friday." },
    ],
    review: {
      status: "Complete",
      summary: "Panel and references both cleared before the offer went out.",
      checklist: [
        { id: "rc-6-rv-1", label: "Portfolio reviewed", done: true },
        { id: "rc-6-rv-2", label: "Panel feedback collected", done: true },
        { id: "rc-6-rv-3", label: "References checked", done: true },
      ],
      strengths: [
        {
          id: "rc-6-str-1",
          point: "Staff-level scope today, compensation already agreed verbally.",
          evidence: "Offer notes: comp discussed and agreed before the formal offer went out.",
        },
        {
          id: "rc-6-str-2",
          point: "Referred by An Vo Thi's former manager, a trusted source.",
          evidence: "Referral note: direct working history with the referrer.",
        },
      ],
      concerns: [
        {
          id: "rc-6-con-1",
          point: "Gone quiet since confirming he received the offer.",
          evidence: "Outreach log: phone confirmation July 29th, no further response since.",
        },
      ],
      unknowns: [
        {
          id: "rc-6-unk-1",
          point: "Unclear if he's weighing a competing offer or just needs time to decide.",
          evidence: "Outreach log: no stated reason for the pause.",
        },
      ],
      readinessVerdict: "Offer is out and terms are agreed; the open question now is his decision, not the pipeline.",
      confidence: "High",
      openQuestions: ["Is he weighing a competing offer, or just needs the week to decide?"],
    },
    decision: {
      recommended: "hold",
      why: "Compensation's agreed and he's confirmed receipt, but he's gone quiet since. Hold here and check in before Friday's deadline rather than escalate.",
    },
    outreach: {
      status: "Awaiting reply",
      touches: [
        { id: "rc-6-ot-1", channel: "Email", sentAt: "2026-07-29", summary: "Sent the formal offer letter.", responded: false },
        { id: "rc-6-ot-2", channel: "Phone", sentAt: "2026-07-29", summary: "Confirmed by phone that he received it.", responded: true },
      ],
      drafts: [
        {
          id: "rc-6-draft-1",
          kind: "interview-scheduling",
          channel: "Email",
          purposeLine: "Check in before Friday's deadline",
          body: "Hi Marcus, just checking in ahead of Friday, happy to hop on a call if anything about the offer needs discussing.",
        },
      ],
    },
    submission: {
      status: "Submitted to hiring manager",
      hiringManager: "An Vo Thi, Head of Product",
      packageIncludes: ["CV", "Portfolio link", "Panel feedback summary", "Reference notes", "Signed offer letter"],
      targetDate: "2026-08-01",
      draftSummary: {
        recommendation: "Move to Hired once he confirms before Friday's deadline; no further review needed.",
        evidence: "Staff-level scope, compensation already agreed, references and panel both cleared before the offer went out.",
        risk: "He's gone quiet since confirming receipt; if no response by Friday, follow up directly rather than let the offer lapse.",
      },
      packet: {
        preparedAt: "2026-07-29",
        summary: {
          recommendation: "Move to Hired once he confirms before Friday's deadline; no further review needed.",
          evidence: "Staff-level scope, compensation already agreed, references and panel both cleared before the offer went out.",
          risk: "He's gone quiet since confirming receipt; if no response by Friday, follow up directly rather than let the offer lapse.",
        },
        highlights: [
          "10 years, staff-level scope at his current company",
          "Referred by An Vo Thi's former manager",
          "Compensation already agreed verbally before the offer went out",
        ],
        stageHistorySnapshot: [
          { id: "rc-6-sh-1", stage: "Sourced", enteredAt: "2026-06-20" },
          { id: "rc-6-sh-2", stage: "Screening", enteredAt: "2026-06-28" },
          { id: "rc-6-sh-3", stage: "Interview", enteredAt: "2026-07-10" },
          { id: "rc-6-sh-4", stage: "Offer", enteredAt: "2026-07-29", note: "Offer sent, response due Friday." },
        ],
        sharedAt: "2026-07-29",
      },
    },
    attentionTemplate: "Strong candidate waiting: offer sent {days} days ago, decision overdue before Friday's deadline.",
  },
  {
    id: "rc-7",
    name: "Khanh Do",
    roleId: "role-aie",
    currentTitle: "Machine Learning Engineer",
    currentCompany: "Orbital Data Co.",
    stage: "Sourced",
    stageEnteredAt: "2026-07-31",
    readiness: "Needs review",
    aiSummary: "Fresh referral with direct pricing-model experience, worth a first screen before the pipeline gets deeper.",
    aiStrengths: "Direct pricing-model experience and a warm internal referral.",
    aiWatchouts: "Still unscreened, worth confirming interest hasn't cooled since he was referred.",
    highlights: [
      "5 years shipping pricing models to production",
      "Referred by a current Saola Labs data scientist",
      "Open to hybrid Ho Chi Minh City work immediately",
    ],
    source: "Referral",
    sourceDetail: "Referred by a current Saola Labs data scientist.",
    suggestedNextStep: "Send the initial screening invite.",
    stageHistory: [{ id: "rc-7-sh-1", stage: "Sourced", enteredAt: "2026-07-31", note: "Referred in by a current team member." }],
    review: {
      status: "Not started",
      summary: "Just entered the pipeline, no screen booked yet.",
      checklist: [
        { id: "rc-7-rv-1", label: "Code sample reviewed", done: false },
        { id: "rc-7-rv-2", label: "Recruiter screen scheduled", done: false },
        { id: "rc-7-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-7-str-1",
          point: "Direct pricing-model experience and a warm internal referral.",
          evidence: "Application: 5 years shipping pricing models, referred by a current data scientist.",
        },
      ],
      concerns: [
        {
          id: "rc-7-con-1",
          point: "Still unscreened, referral is fresh but unconfirmed.",
          evidence: "Pipeline log: referred in July 31st, no screen booked yet.",
        },
      ],
      unknowns: [],
      readinessVerdict: "Promising on paper; the first screen will confirm whether interest is still warm.",
      confidence: "Medium",
      openQuestions: [],
    },
    decision: {
      recommended: "request-info",
      why: "Warm referral with a direct skills match, but he hasn't been screened yet. Send the invite and confirm he's still interested before going further.",
    },
    outreach: {
      status: "Not started",
      touches: [],
    },
    submission: {
      status: "Not started",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Recruiter notes"],
    },
  },
  {
    id: "rc-8",
    name: "Rahul Mehta",
    roleId: "role-aie",
    currentTitle: "Data Scientist",
    currentCompany: "Fen River Analytics",
    stage: "Sourced",
    stageEnteredAt: "2026-07-22",
    readiness: "Stale",
    aiSummary: "Applied inbound with a strong recommendation-systems background, but no outreach has gone out yet.",
    aiStrengths: "6 years in recommendation systems, cover note references this role's problem specifically.",
    aiWatchouts: "Applied 10 days ago with zero outreach sent, he may assume the role is filled.",
    highlights: [
      "6 years in recommendation systems at consumer marketplaces",
      "Cover note references Saola Labs' seller-matching problem specifically",
      "No response from the team since he applied",
    ],
    source: "Inbound",
    sourceDetail: "Applied directly through the Saola Labs careers page.",
    suggestedNextStep: "Send the first outreach message today before he assumes the role is filled.",
    stageHistory: [{ id: "rc-8-sh-1", stage: "Sourced", enteredAt: "2026-07-22", note: "Applied inbound." }],
    review: {
      status: "Not started",
      summary: "Application on file well over a week, no outreach sent yet.",
      checklist: [
        { id: "rc-8-rv-1", label: "Code sample reviewed", done: false },
        { id: "rc-8-rv-2", label: "Recruiter screen scheduled", done: false },
        { id: "rc-8-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-8-str-1",
          point: "6 years in recommendation systems, a direct match for the role.",
          evidence: "Application: cover note references Saola Labs' seller-matching problem by name.",
        },
        {
          id: "rc-8-str-2",
          point: "Applied inbound, already motivated to join.",
          evidence: "Application: submitted directly through the careers page, not sourced.",
        },
      ],
      concerns: [
        {
          id: "rc-8-con-1",
          point: "Applied 10 days ago with zero outreach sent so far.",
          evidence: "Pipeline log: application dated July 22nd, no touches logged since.",
        },
      ],
      unknowns: [
        {
          id: "rc-8-unk-1",
          point: "Unclear if he's assumed the role is filled and moved on.",
          evidence: "Pipeline log: nothing has been sent to him yet, so no response is possible.",
        },
      ],
      readinessVerdict: "Strong match going cold from recruiter delay, not candidate disinterest; needs the first outreach today.",
      confidence: "Medium",
      openQuestions: ["Has he already accepted another offer while waiting to hear back?"],
    },
    decision: {
      recommended: "request-info",
      why: "He applied 10 days ago with a strong recommendation-systems match and zero outreach sent. He may already assume the role is filled, reach out today to find out.",
    },
    outreach: {
      status: "Not started",
      touches: [],
      drafts: [
        {
          id: "rc-8-draft-1",
          kind: "screening-invite",
          channel: "Email",
          purposeLine: "Send Rahul's overdue first outreach",
          body: "Hi Rahul, apologies for the delay getting back to you, your recommendation-systems background is a strong match, are you still open to a first call?",
        },
        {
          id: "rc-8-draft-2",
          kind: "respectful-close",
          channel: "Email",
          purposeLine: "Close out respectfully if he's already moved on",
          body: "Hi Rahul, checking in before we close your file: if you've already accepted something else, no worries at all, thank you for your interest and we'd love to stay in touch for future openings.",
        },
      ],
    },
    submission: {
      status: "Not started",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Recruiter notes"],
    },
    attentionTemplate: "Stale {days} days in Sourced: he applied inbound and still hasn't heard back from anyone.",
  },
  {
    id: "rc-9",
    name: "Yuki Tanaka",
    roleId: "role-aie",
    currentTitle: "ML Engineer",
    currentCompany: "Kestrel Vision",
    stage: "Screening",
    stageEnteredAt: "2026-07-29",
    readiness: "Ready to advance",
    aiSummary: "Technical screen went smoothly, strong production ML background, ready for the case-study round.",
    aiStrengths: "Take-home exercise scored in the top band, comfortable presenting tradeoffs to non-technical stakeholders.",
    aiWatchouts: "No watchouts yet, the pipeline so far has been clean.",
    highlights: [
      "4 years, shipped 3 models to production at her current company",
      "Take-home exercise scored in the top band",
      "Comfortable presenting model tradeoffs to non-technical stakeholders",
    ],
    source: "Sourced",
    sourceDetail: "Found through a targeted search for production recommendation-systems engineers.",
    suggestedNextStep: "Move to Interview and schedule the case-study round.",
    stageHistory: [
      { id: "rc-9-sh-1", stage: "Sourced", enteredAt: "2026-07-15" },
      { id: "rc-9-sh-2", stage: "Screening", enteredAt: "2026-07-29", note: "Take-home exercise scored strong." },
    ],
    review: {
      status: "Complete",
      summary: "Take-home exercise and recruiter screen both passed.",
      checklist: [
        { id: "rc-9-rv-1", label: "Code sample reviewed", done: true },
        { id: "rc-9-rv-2", label: "Recruiter screen completed", done: true },
        { id: "rc-9-rv-3", label: "Take-home exercise scored", done: true },
      ],
      strengths: [
        {
          id: "rc-9-str-1",
          point: "Take-home exercise scored in the top band.",
          evidence: "Screen notes: highest score of this pipeline's take-home submissions.",
        },
      ],
      concerns: [],
      unknowns: [],
      readinessVerdict: "Clean pipeline so far, ready for the case-study round.",
      confidence: "High",
      openQuestions: [],
    },
    decision: {
      recommended: "advance",
      why: "Technical screen went smoothly with strong production ML depth and clean stakeholder communication. Ready for the case-study round.",
    },
    outreach: {
      status: "Responded",
      touches: [{ id: "rc-9-ot-1", channel: "Email", sentAt: "2026-07-16", summary: "Sent the take-home exercise.", responded: true }],
    },
    submission: {
      status: "Not started",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Recruiter notes"],
    },
  },
  {
    id: "rc-10",
    name: "Hoang Minh Chau",
    roleId: "role-aie",
    currentTitle: "AI Engineer",
    currentCompany: "Sable Systems",
    stage: "Interview",
    stageEnteredAt: "2026-07-27",
    readiness: "Ready to advance",
    aiSummary: "Case-study round landed well, the team's ready to move to an offer once compensation expectations are confirmed.",
    aiStrengths: "Case-study round scored the highest of this pipeline, direct pricing-model fit.",
    aiWatchouts: "Compensation expectations aren't confirmed yet, worth locking down before drafting an offer.",
    highlights: [
      "5 years, direct pricing-model experience matching the role exactly",
      "Case-study round scored the highest of this pipeline",
      "Compensation expectations not yet confirmed",
    ],
    source: "Inbound",
    sourceDetail: "Applied directly through the Saola Labs careers page.",
    suggestedNextStep: "Confirm compensation expectations, then move to Offer.",
    stageHistory: [
      { id: "rc-10-sh-1", stage: "Sourced", enteredAt: "2026-07-14" },
      { id: "rc-10-sh-2", stage: "Screening", enteredAt: "2026-07-20" },
      { id: "rc-10-sh-3", stage: "Interview", enteredAt: "2026-07-27", note: "Case-study round scored strong." },
    ],
    review: {
      status: "Complete",
      summary: "Case-study round scored the strongest in this pipeline.",
      checklist: [
        { id: "rc-10-rv-1", label: "Code sample reviewed", done: true },
        { id: "rc-10-rv-2", label: "Technical screen completed", done: true },
        { id: "rc-10-rv-3", label: "Case-study round completed", done: true },
      ],
      strengths: [
        {
          id: "rc-10-str-1",
          point: "Case-study round scored the highest of this pipeline.",
          evidence: "Panel feedback: top score, direct pricing-model fit called out specifically.",
        },
      ],
      concerns: [
        {
          id: "rc-10-con-1",
          point: "Compensation expectations aren't confirmed yet.",
          evidence: "Screen notes: call held July 28th, expectations not yet shared.",
        },
      ],
      unknowns: [],
      readinessVerdict: "Strongest candidate in this pipeline; just needs compensation confirmed before drafting an offer.",
      confidence: "High",
      openQuestions: [],
    },
    decision: {
      recommended: "request-info",
      why: "Case-study round scored the strongest in this pipeline and the pricing-model fit is direct. Confirm compensation expectations before drafting an offer.",
    },
    outreach: {
      status: "Responded",
      touches: [
        {
          id: "rc-10-ot-1",
          channel: "Phone",
          sentAt: "2026-07-28",
          summary: "Called to confirm interest before drafting an offer.",
          responded: true,
        },
      ],
    },
    submission: {
      status: "Packet in progress",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Case-study feedback"],
      targetDate: "2026-08-06",
    },
    notes:
      "Team's excited about this one, strongest case-study score we've seen for this role. Just need comp numbers before we can move.",
  },
  {
    id: "rc-11",
    name: "Anna Petrova",
    roleId: "role-aie",
    currentTitle: "Senior ML Engineer",
    currentCompany: "Meridian Data Co.",
    stage: "Hired",
    stageEnteredAt: "2026-07-31",
    readiness: "Ready to advance",
    aiSummary: "Signed and accepted, starting August 18th, the search for this seat is closed.",
    aiStrengths: "7 years leading pricing-model rollouts, accepted the offer within 24 hours.",
    aiWatchouts: "None, this search is closed.",
    highlights: [
      "7 years, led pricing-model rollouts at her last two companies",
      "Referred by Trong Le's former colleague",
      "Accepted within 24 hours of receiving the offer",
    ],
    source: "Referral",
    sourceDetail: "Referred by Trong Le's former colleague.",
    suggestedNextStep: "Hand off to onboarding, no further recruiter action needed.",
    stageHistory: [
      { id: "rc-11-sh-1", stage: "Sourced", enteredAt: "2026-06-10" },
      { id: "rc-11-sh-2", stage: "Screening", enteredAt: "2026-06-18" },
      { id: "rc-11-sh-3", stage: "Interview", enteredAt: "2026-06-28" },
      { id: "rc-11-sh-4", stage: "Offer", enteredAt: "2026-07-20" },
      { id: "rc-11-sh-5", stage: "Hired", enteredAt: "2026-07-31", note: "Signed offer, start date August 18." },
    ],
    review: {
      status: "Complete",
      summary: "Fully cleared: panel, references, and offer all signed off.",
      checklist: [
        { id: "rc-11-rv-1", label: "Code sample reviewed", done: true },
        { id: "rc-11-rv-2", label: "Panel feedback collected", done: true },
        { id: "rc-11-rv-3", label: "References checked", done: true },
      ],
      strengths: [
        {
          id: "rc-11-str-1",
          point: "7 years leading pricing-model rollouts at her last two companies.",
          evidence: "Application: led rollouts end to end at both prior employers.",
        },
      ],
      concerns: [],
      unknowns: [],
      readinessVerdict: "Signed and accepted, starting August 18th. No further review needed.",
      confidence: "High",
      openQuestions: [],
    },
    outreach: {
      status: "Responded",
      touches: [{ id: "rc-11-ot-1", channel: "Email", sentAt: "2026-07-20", summary: "Sent the signed offer letter.", responded: true }],
    },
    submission: {
      status: "Submitted to hiring manager",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Case-study feedback", "Reference notes", "Signed offer letter"],
      targetDate: "2026-07-20",
    },
  },
  {
    id: "rc-12",
    name: "David Okafor",
    roleId: "role-aie",
    currentTitle: "Data Engineer",
    currentCompany: "Ferry Point Logistics",
    stage: "Closed",
    stageEnteredAt: "2026-07-18",
    readiness: "Blocked",
    aiSummary: "Strong data engineering background but no production ML model experience, closed out after the technical screen.",
    aiStrengths: "6 years of strong data engineering fundamentals.",
    aiWatchouts: "No production ML model experience, the core requirement for this specific role.",
    highlights: [
      "6 years in data engineering, no direct model-shipping experience",
      "Technical screen confirmed the gap the resume hinted at",
      "Open to reconnecting for a data engineering opening instead",
    ],
    source: "Sourced",
    sourceDetail: "Found through a search for data platform engineers.",
    suggestedNextStep: "No action needed, consider for a future data engineering opening.",
    stageHistory: [
      { id: "rc-12-sh-1", stage: "Sourced", enteredAt: "2026-07-08" },
      { id: "rc-12-sh-2", stage: "Screening", enteredAt: "2026-07-14" },
      {
        id: "rc-12-sh-3",
        stage: "Closed",
        enteredAt: "2026-07-18",
        note: "Closed after the technical screen surfaced a gap in production ML experience.",
      },
    ],
    review: {
      status: "Complete",
      summary: "Technical screen confirmed the role isn't a fit today.",
      checklist: [
        { id: "rc-12-rv-1", label: "Code sample reviewed", done: true },
        { id: "rc-12-rv-2", label: "Technical screen completed", done: true },
        { id: "rc-12-rv-3", label: "References requested", done: false },
      ],
      strengths: [
        {
          id: "rc-12-str-1",
          point: "6 years of strong data engineering fundamentals.",
          evidence: "Application: solid platform-engineering background across two roles.",
        },
      ],
      concerns: [
        {
          id: "rc-12-con-1",
          point: "No production ML model experience, the core requirement for this role.",
          evidence: "Screen notes: technical screen confirmed the gap directly.",
        },
      ],
      unknowns: [],
      readinessVerdict: "Not a fit for this specific role today; worth reconnecting for a data engineering opening instead.",
      confidence: "High",
      openQuestions: [],
    },
    outreach: {
      status: "Responded",
      touches: [
        {
          id: "rc-12-ot-1",
          channel: "Email",
          sentAt: "2026-07-18",
          summary: "Sent a closing note, kept the door open for future data engineering roles.",
          responded: true,
        },
      ],
    },
    submission: {
      status: "Not started",
      hiringManager: "Trong Le, Head of Data",
      packageIncludes: ["CV", "Code sample", "Recruiter notes"],
    },
  },
];
