import type { AiInsight } from "@/lib/types";

// Full scripted AI output for every opportunity: summary, credibility, and
// fit. Plus one tailoring insight for the opportunity with a linked tailored
// CV, and gap insights for each skill flagged as a gap.
export const insights: AiInsight[] = [
  // --- opp-1: Solace AI -------------------------------------------------
  {
    id: "insight-opp-1-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    body: "Staff-level design role at Solace AI owning the model-explainability layer for clinical decision-support tools. Reports to the VP of Product, works alongside a five-person research team. Comes in through a warm referral from a former Kestrel Analytics colleague.",
  },
  {
    id: "insight-opp-1-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    verdict: "pass",
    reasons: [
      "Company site, funding history, and leadership team are all verifiable.",
      "Referral source has worked with Solace AI's design team directly.",
      "Compensation range is consistent with staff-level roles at similarly staged companies.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-1-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    level: "Strong",
    strengths: [
      "Direct overlap with the explainability panel you shipped at Fintra.",
      "Referral gives you a credible internal voice before you even apply.",
      "Staff scope matches the leadership direction you're aiming for.",
    ],
    concerns: [
      "Clinical domain is new; you'll want to speak to how explainability principles transfer from lending to healthcare.",
    ],
    unknowns: [
      "Team size and structure past the immediate five-person research team are not public.",
    ],
    confidence: "High",
  },

  // --- opp-2: Vanta Growth Labs (fails credibility) ----------------------
  {
    id: "insight-opp-2-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-2",
    createdAt: "2026-07-10",
    body: "Listing for a senior product designer at 'Vanta Growth Labs', described only as a 'category-defining growth platform' with no named product, manager, or team.",
  },
  {
    id: "insight-opp-2-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-2",
    createdAt: "2026-07-10",
    verdict: "fail",
    reasons: [
      "Company domain was registered two months ago and has no team, product, or funding information.",
      "Posting cannot be matched to any LinkedIn company page or press coverage.",
      "Compensation range sits well above market for a role with this little scope detail, a common inflation pattern in low-credibility postings.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-2-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-2",
    createdAt: "2026-07-10",
    level: "Unknown",
    strengths: [],
    concerns: [
      "No verifiable product or team means fit cannot be judged responsibly yet.",
    ],
    unknowns: [
      "What the product actually is.",
      "Who you would report to.",
      "Whether this posting is legitimate at all.",
    ],
    confidence: "Low",
  },

  // --- opp-3: Northwind Robotics -----------------------------------------
  {
    id: "insight-opp-3-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-3",
    createdAt: "2026-05-14",
    body: "Product Design Lead role at Northwind Robotics, leading design for a fleet-operations dashboard used by on-site warehouse technicians. Hybrid in Ho Chi Minh City.",
  },
  {
    id: "insight-opp-3-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-3",
    createdAt: "2026-05-14",
    verdict: "pass",
    reasons: [
      "Company site, funded rounds, and current employees are all verifiable.",
      "Posting matches Northwind's public product description.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-3-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-3",
    createdAt: "2026-05-14",
    level: "Medium",
    strengths: [
      "Operations-dashboard design overlaps with your Kestrel Analytics experience.",
      "Lead scope fits your move toward leadership.",
    ],
    concerns: [
      "Hardware-adjacent, technician-facing domain is new territory with no direct precedent in your track record.",
      "No AI or model-facing work in the listed scope, off your target direction.",
    ],
    unknowns: [
      "Whether the eleven-week-old posting reflects an active search or a stalled one.",
    ],
    confidence: "Medium",
  },

  // --- opp-4: Arclight AI --------------------------------------------------
  {
    id: "insight-opp-4-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-4",
    createdAt: "2026-06-20",
    body: "Senior product designer role at Arclight AI, owning the suggestion and approval surfaces for a workflow-automation assistant used by operations teams.",
  },
  {
    id: "insight-opp-4-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-4",
    createdAt: "2026-06-20",
    verdict: "pass",
    reasons: [
      "Posted directly on Arclight's own careers page with a named hiring manager.",
      "Team and funding are consistent with public reporting.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-4-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-4",
    createdAt: "2026-06-20",
    level: "Strong",
    strengths: [
      "Suggestion and approval surface design is close to the trust-boundary work you shipped at Fintra.",
      "APAC-hours remote role fits your location and remote preference exactly.",
    ],
    concerns: [
      "Smaller team than your current one, less room for informal mentorship in the near term.",
    ],
    unknowns: [
      "Whether the role has a path to design leadership as the team grows.",
    ],
    confidence: "High",
  },

  // --- opp-5: Tidal Finance -------------------------------------------------
  {
    id: "insight-opp-5-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-5",
    createdAt: "2026-06-05",
    body: "Generalist senior product designer role at Tidal Finance, a consumer savings app, covering onboarding and rewards. On-site in Ho Chi Minh City.",
  },
  {
    id: "insight-opp-5-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-5",
    createdAt: "2026-06-05",
    verdict: "pass",
    reasons: [
      "Recruiter and company are both verifiable with an active product in market.",
    ],
    confidence: "Medium",
  },
  {
    id: "insight-opp-5-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-5",
    createdAt: "2026-06-05",
    level: "Weak",
    strengths: [
      "Consumer fintech domain is familiar from your Fintra work.",
    ],
    concerns: [
      "Scope is broad and shallow relative to your current depth on any one surface.",
      "On-site only, no path to the remote flexibility you're prioritizing.",
      "No AI-facing work in the listed scope.",
    ],
    unknowns: [],
    confidence: "High",
  },

  // --- opp-6: Meridian Labs ---------------------------------------------
  {
    id: "insight-opp-6-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-05-02",
    body: "Senior product designer role at Meridian Labs, owning the evaluation console for a platform that trains and evaluates applied AI models, including how confidence and uncertainty are surfaced to model reviewers.",
  },
  {
    id: "insight-opp-6-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-05-02",
    verdict: "pass",
    reasons: [
      "Came through a direct referral from Fintra's design director, who has spoken to the hiring manager.",
      "Two completed interview rounds have matched the original posting's scope.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-6-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-07-27",
    level: "Strong",
    strengths: [
      "Confidence and uncertainty surfacing is nearly identical to the explainability panel you shipped at Fintra.",
      "Global remote role matches your location and remote preference.",
      "Two rounds in, feedback so far has been positive on both fronts.",
    ],
    concerns: [
      "Panel round will likely probe leadership judgment more than craft, an area with less direct evidence in your track record so far.",
    ],
    unknowns: [
      "Final compensation band has not been discussed yet.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-6-tailoring",
    kind: "tailoring",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-07-18",
    confidence: "High",
    suggestions: [
      {
        id: "tailor-opp-6-summary",
        section: "Summary",
        suggestion: "Lead with the explainability panel work first, since it maps directly to Meridian's evaluation console, rather than your general fintech background.",
        state: "accepted",
      },
      {
        id: "tailor-opp-6-experience",
        section: "Experience",
        suggestion: "Name the specific confidence and contributing-factor indicators you designed, panel reviewers will recognize the pattern immediately.",
        state: "accepted",
      },
      {
        id: "tailor-opp-6-relevant-work",
        section: "Relevant to this role",
        suggestion: "Add a line on the trust-boundary spec from your discovery sprint, it answers the leadership-judgment question before they ask it.",
        state: "suggested",
      },
    ],
  },

  // --- opp-7: Brightpath Bank --------------------------------------------
  {
    id: "insight-opp-7-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-7",
    createdAt: "2026-04-18",
    body: "Product Design Manager role at Brightpath Bank, a digital-first retail bank, leading a three-person design team on lending products. First-time manager role.",
  },
  {
    id: "insight-opp-7-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-7",
    createdAt: "2026-04-18",
    verdict: "pass",
    reasons: [
      "Outreach came from a verified Brightpath recruiter with a LinkedIn history at the company.",
      "Final loop included the current design team, consistent with the stated team size.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-7-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-7",
    createdAt: "2026-07-20",
    level: "Medium",
    strengths: [
      "First management scope matches your people-leadership goal directly.",
      "Lending domain overlaps closely with your Fintra work.",
    ],
    concerns: [
      "Lighter on AI-specific work than your primary target direction.",
      "No formal management experience yet, panel likely weighed this during the loop.",
    ],
    unknowns: [
      "Decision timeline was not shared at the end of the final loop.",
    ],
    confidence: "Medium",
  },

  // --- opp-8: Orbit Logistics --------------------------------------------
  {
    id: "insight-opp-8-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-8",
    createdAt: "2026-05-25",
    body: "Senior product designer offer from Orbit Logistics, owning the dispatcher console for a last-mile delivery route-planning product.",
  },
  {
    id: "insight-opp-8-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-8",
    createdAt: "2026-05-25",
    verdict: "pass",
    reasons: [
      "Sourced directly from Orbit's careers page and confirmed through the full interview loop.",
    ],
    confidence: "High",
  },
  {
    id: "insight-opp-8-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-8",
    createdAt: "2026-07-29",
    level: "Strong",
    strengths: [
      "Console-design scope is a clean match for your dashboard and operational-tooling experience.",
      "Remote APAC role fits your location and remote preference exactly.",
    ],
    concerns: [
      "Less AI-forward than your primary target direction, this would be a lateral move on that dimension.",
      "Base salary sits at the low end of the range you told Copilot you're targeting.",
    ],
    unknowns: [],
    confidence: "High",
  },

  // --- opp-9: Vela Studio (closed) ---------------------------------------
  {
    id: "insight-opp-9-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-9",
    createdAt: "2026-04-02",
    body: "Senior product designer role at Vela Studio, a design agency staffing designers onto short-term US-hours client engagements. Withdrawn after the first screen.",
  },
  {
    id: "insight-opp-9-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-9",
    createdAt: "2026-04-02",
    verdict: "pass",
    reasons: [
      "Agency and current client roster are both verifiable.",
    ],
    confidence: "Medium",
  },
  {
    id: "insight-opp-9-fit",
    kind: "fit",
    hostType: "opportunity",
    hostId: "opp-9",
    createdAt: "2026-04-20",
    level: "Weak",
    strengths: [
      "Agency pace matches the fast turnaround you handled at Bambu Studio.",
    ],
    concerns: [
      "US-hours overlap proved unworkable alongside your current schedule.",
      "Short-term client staffing model offers little continuity toward your target direction.",
    ],
    unknowns: [],
    confidence: "High",
  },

  // --- Skill gap insights --------------------------------------------------
  {
    id: "insight-skill-5-gap",
    kind: "gap",
    hostType: "skill",
    hostId: "skill-5",
    createdAt: "2026-07-01",
    skillId: "skill-5",
    note: "AI and ML literacy sits at level 2 against a target of 4 for the AI product design direction. Your explainability and discovery-sprint work shows strong instincts, but you have not yet formally studied how the underlying models behave.",
    confidence: "High",
  },
  {
    id: "insight-skill-6-gap",
    kind: "gap",
    hostType: "skill",
    hostId: "skill-6",
    createdAt: "2026-07-01",
    skillId: "skill-6",
    note: "AI interaction and prompt design sits at level 2 against a target of 4. You've designed around model output, but haven't yet designed the prompting or interaction layer itself.",
    confidence: "High",
  },
  {
    id: "insight-skill-8-gap",
    kind: "gap",
    hostType: "skill",
    hostId: "skill-8",
    createdAt: "2026-07-01",
    skillId: "skill-8",
    note: "People management sits at level 1 against a target of 4. Mentorship shows real leadership instinct, but you've never had formal direct reports, which several of your active opportunities will test.",
    confidence: "High",
  },
  {
    id: "insight-skill-12-gap",
    kind: "gap",
    hostType: "skill",
    hostId: "skill-12",
    createdAt: "2026-07-01",
    skillId: "skill-12",
    note: "Public speaking and thought leadership sits at level 2 against a target of 4. One well-received talk in 2022 with nothing published since is the main gap holding back your visibility goal.",
    confidence: "Medium",
  },
];
