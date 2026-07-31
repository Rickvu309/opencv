import type { AiInsight } from "@/lib/types";

// Full scripted AI output for every opportunity: summary (Overview tab), then
// the three AI Analysis tab layers, interpretation, credibility, and fit.
// Plus one tailoring insight for the opportunity with a linked tailored CV,
// and gap insights for each skill flagged as a gap.
export const insights: AiInsight[] = [
  // --- opp-1: Solace AI ---------------------------------------------------
  {
    id: "insight-opp-1-summary",
    kind: "summary",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    body: "Staff-level design role at Solace AI owning the model-explainability layer for clinical decision-support tools. Reports to the VP of Product, works alongside a five-person research team. Comes in through a warm referral from a former Kestrel Analytics colleague.",
  },
  {
    id: "insight-opp-1-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    plainLanguageRead:
      "Solace wants one senior owner for how their clinical AI explains its decisions to the people who rely on them. This is a staff seat set up to define design standards, not execute someone else's spec.",
    expectations: [
      {
        id: "exp-opp-1-1",
        label: "Owns explainability end to end",
        rationale:
          "The posting names one person accountable for the whole explainability layer, not a surface split across several designers. Expect to set direction as well as ship it.",
      },
      {
        id: "exp-opp-1-2",
        label: "Works staff-to-staff with a research team",
        rationale:
          "Partnering with a five-person research team at this level means translating model behavior yourself, not waiting for a PM to hand you a spec.",
      },
      {
        id: "exp-opp-1-3",
        label: "Sets the bar for future staff hires",
        rationale:
          "Being the design quality reference for hires who come after you is a leadership signal dressed up as an individual-contributor requirement.",
      },
      {
        id: "exp-opp-1-4",
        label: "Reports directly to the VP of Product",
        rationale:
          "No design manager in between means your judgment gets tested in front of product leadership every week, with less internal cover.",
      },
    ],
    vagueLanguage: {
      phrase: "translate model behavior into trustworthy interface patterns",
      decoded:
        "There is no existing design system for this. You would be inventing the visual language for model confidence and uncertainty largely from scratch.",
    },
    whyThisReading:
      "Built from the staff-level scope, the single-owner framing, and the direct VP reporting line, all pointing at a design-leadership seat rather than a production role.",
    confidence: "High",
  },
  {
    id: "insight-opp-1-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-1",
    createdAt: "2026-06-02",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-1-pos-1",
        label: "Company and leadership are verifiable",
        why: "Solace AI's funding history, leadership team, and hospital-systems research-lab origin all check out against public sources.",
      },
      {
        id: "cred-opp-1-pos-2",
        label: "Referral has direct visibility",
        why: "The referring contact has worked with Solace's design team directly, not just heard about the opening secondhand.",
      },
      {
        id: "cred-opp-1-pos-3",
        label: "Compensation matches the stated scope",
        why: "The $120,000 to $150,000 range sits squarely inside what staff-level roles pay at similarly staged Series B companies.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "Every verifiable detail, funding, leadership, referral, and pay, lines up with what a real staff-level opening at this stage of company looks like.",
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
      "Owning the model-explainability layer here mirrors the explainability panel you shipped at Fintra, your strongest AI and ML literacy evidence.",
      "The referral gives you a credible internal voice before you even apply, rare leverage for a Dream opportunity.",
      "Staff scope matches your goal to land a senior or staff AI product design role directly.",
    ],
    concerns: [
      "Clinical domain is new; your case study for Publish a portfolio case study on AI explainability should draw a clear line from lending to healthcare.",
    ],
    unknowns: [
      "Team size and structure past the immediate five-person research team are not public yet.",
    ],
    tradeoff: {
      gain: "A staff-level seat defining design standards for an AI-native company at the center of your target direction.",
      give: "The safety of Fintra's established design system, traded for building one from nothing.",
    },
    alignmentLine:
      "Closest match yet to your target direction of AI product design and leadership, this is the role the rest of your search is being measured against.",
    whyThisReading:
      "Weighed your Fintra explainability work, the referral's credibility, and the staff-level scope against the one open question on team structure.",
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
    id: "insight-opp-2-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-2",
    createdAt: "2026-07-10",
    plainLanguageRead:
      "The posting asks for a senior designer to own a 'category-defining growth platform' without saying what the platform does, who runs it, or who you would report to.",
    expectations: [
      {
        id: "exp-opp-2-1",
        label: "Own an unnamed growth platform",
        rationale:
          "No product name, screenshot, or customer reference appears anywhere in the listing, unusual for a role at this seniority.",
      },
      {
        id: "exp-opp-2-2",
        label: "Work in high ambiguity by design",
        rationale:
          "The requirement to be comfortable in ambiguous, fast-moving environments is doing a lot of work here. It may describe a real early-stage culture, or cover for a listing that is not fully formed.",
      },
      {
        id: "exp-opp-2-3",
        label: "Collaborate with an unnamed team",
        rationale:
          "No manager, product lead, or teammate is named anywhere the posting can be checked against.",
      },
    ],
    vagueLanguage: {
      phrase: "category-defining growth platform",
      decoded:
        "This phrase names no product, market, or customer. It reads as filler standing in for a real product description.",
    },
    whyThisReading:
      "Flagged because three separate fields, product, manager, and team, all resolve to nothing checkable, not just one.",
    confidence: "High",
  },
  {
    id: "insight-opp-2-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-2",
    createdAt: "2026-07-10",
    verdict: "fail",
    positiveSignals: [],
    cautionSignals: [
      {
        id: "cred-opp-2-caution-1",
        label: "Vague company information",
        why: "The domain was registered two months ago with no team page, funding history, or product description behind it.",
      },
      {
        id: "cred-opp-2-caution-2",
        label: "Salary far above market",
        why: "$140,000 to $180,000 is well above typical pay for a role with this little scope detail, a common inflation pattern used to attract applicants to thin listings.",
      },
      {
        id: "cred-opp-2-caution-3",
        label: "No named team",
        why: "No hiring manager, product lead, or current employee can be matched to this listing on any professional network.",
      },
    ],
    whyThisReading:
      "All three checks that normally confirm a real opening, company presence, market-consistent pay, and a named team, come back empty here.",
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
      "No verifiable product or team means fit against your target direction of AI product design and leadership cannot be judged responsibly yet.",
    ],
    unknowns: [
      "What the product actually is.",
      "Who you would report to.",
      "Whether this posting is legitimate at all.",
    ],
    tradeoff: {
      gain: "Nothing confirmed yet, there is no real offer to weigh gains against.",
      give: "Time spent pursuing this is time not spent on your three verified Strong-fit opportunities.",
    },
    alignmentLine:
      "Cannot be measured against your target direction until the credibility flag clears.",
    whyThisReading:
      "With the credibility check failing, judging fit would mean inventing a product and team that do not yet check out anywhere.",
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
    id: "insight-opp-3-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-3",
    createdAt: "2026-05-14",
    plainLanguageRead:
      "Northwind wants a lead designer for the dashboard their on-site technicians use to run a robot fleet, a hands-on operational tool, not a growth or consumer surface.",
    expectations: [
      {
        id: "exp-opp-3-1",
        label: "Lead design for field technicians, not office users",
        rationale:
          "The dashboard is used by people standing in a warehouse, not at a desk, so usability constraints come from the physical environment as much as the interface.",
      },
      {
        id: "exp-opp-3-2",
        label: "Partner across hardware and firmware constraints",
        rationale:
          "Design decisions here are bounded by physical robotics limits engineers set, a different collaboration model than a pure software team.",
      },
      {
        id: "exp-opp-3-3",
        label: "Run field research directly with technicians",
        rationale:
          "Research happens on-site with the people operating the fleet, not through a research ops team or remote sessions.",
      },
      {
        id: "exp-opp-3-4",
        label: "Mentor two mid-level designers",
        rationale:
          "Lead scope here includes people development on a two-person pod, a step toward management without full authority over hiring or reviews.",
      },
    ],
    vagueLanguage: {
      phrase: "leading design for a fleet-operations dashboard",
      decoded:
        "This reads as one console, but the responsibilities list several distinct technician workflows, likely closer to owning three or four separate tools under one dashboard label.",
    },
    whyThisReading:
      "Read from the responsibilities list, which names hardware partnering and field research explicitly, both markers of an operational rather than consumer product.",
    confidence: "Medium",
  },
  {
    id: "insight-opp-3-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-3",
    createdAt: "2026-05-14",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-3-pos-1",
        label: "Company and funding are verifiable",
        why: "Northwind's Series C round, roughly 200-person headcount, and customer list are all publicly confirmable.",
      },
      {
        id: "cred-opp-3-pos-2",
        label: "Posting matches the public product description",
        why: "The scope described lines up with what Northwind's own site says the fleet-operations product does.",
      },
    ],
    cautionSignals: [
      {
        id: "cred-opp-3-caution-1",
        label: "Posting has sat unfilled for eleven weeks",
        why: "No update since it was first saved, which can mean a stalled search or a lower-priority hire than the listing suggests.",
      },
    ],
    whyThisReading:
      "Company facts check out cleanly, the only open question is whether the search itself is still active.",
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
      "Operations-dashboard design overlaps with your Kestrel Analytics experience, the same track record behind your Data storytelling with metrics skill.",
      "Lead scope, including mentoring two designers, fits your goal to grow into people leadership.",
    ],
    concerns: [
      "Hardware-adjacent, technician-facing domain has no direct precedent in your AI and ML literacy track record.",
      "No AI or model-facing work in the listed scope, a step away from your target direction of AI product design and leadership.",
    ],
    unknowns: [
      "Whether the eleven-week-old posting reflects an active search or a stalled one.",
    ],
    tradeoff: {
      gain: "Real lead-title scope and mentoring experience toward people leadership.",
      give: "A step away from the AI-facing work your target direction is built around.",
    },
    alignmentLine:
      "Off to the side of your target direction, useful for leadership reps but not for the AI-product goal driving your search.",
    whyThisReading:
      "Mentoring scope counts in your favor, the missing AI-facing work and the stalled-looking posting both pull the rating down to Medium.",
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
    id: "insight-opp-4-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-4",
    createdAt: "2026-06-20",
    plainLanguageRead:
      "Arclight wants one designer to own how their workflow assistant explains a suggestion and lets a human approve or reject it, the exact trust-boundary problem your current work already solves.",
    expectations: [
      {
        id: "exp-opp-4-1",
        label: "Own suggestion and approval surfaces end to end",
        rationale:
          "One designer is accountable for the full loop from the assistant's suggestion to the human's decision, not just the suggestion screen.",
      },
      {
        id: "exp-opp-4-2",
        label: "Define how the assistant explains itself before approval",
        rationale:
          "You would be setting the explanation pattern the assistant uses every time it asks a human to trust it, a direct trust-boundary design problem.",
      },
      {
        id: "exp-opp-4-3",
        label: "Work APAC hours on a small pod",
        rationale:
          "A three-person pod with a senior engineer and data scientist means design decisions get made in small, fast rooms, with less buffer if priorities shift.",
      },
      {
        id: "exp-opp-4-4",
        label: "Validate with operations-team beta customers directly",
        rationale:
          "Usability sessions run with real beta customers, not internal stand-ins, so findings carry more weight but also more visibility.",
      },
    ],
    vagueLanguage: {
      phrase: "suggestion and approval surfaces",
      decoded:
        "This covers more than one screen. It implies the full decision flow: what the assistant proposes, how confident it says it is, and what happens after a human overrides it.",
    },
    whyThisReading:
      "Read from the pod size and the explicit approval-surface language, both pointing to a role built around the same suggest-then-approve pattern you already design for.",
    confidence: "High",
  },
  {
    id: "insight-opp-4-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-4",
    createdAt: "2026-06-20",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-4-pos-1",
        label: "Named hiring manager on the careers page",
        why: "Posted directly on Arclight's own site with a manager name attached, not a third-party board.",
      },
      {
        id: "cred-opp-4-pos-2",
        label: "Team and funding match public reporting",
        why: "Headcount and Series A funding are consistent with press coverage and the company's public engineering blog.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "Direct company-site sourcing plus a named manager and a public engineering blog together confirm this is a real, active opening.",
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
      "Suggestion and approval surface design is close to the trust-boundary work you already ship at Fintra, the strongest evidence behind your AI interaction and prompt design skill.",
      "APAC-hours remote role fits your Remote work-style preference and Ho Chi Minh City location exactly.",
      "Directly supports your goal to land a senior or staff AI product design role.",
    ],
    concerns: [
      "Smaller team than your current one, less room for informal mentorship, a step back for your Grow into people leadership goal.",
    ],
    unknowns: [
      "Whether the role has a path to design leadership as the team grows.",
    ],
    tradeoff: {
      gain: "Direct, hands-on ownership of the exact trust-boundary pattern your target direction is built around.",
      give: "Less team around you day to day, and no clear leadership track yet.",
    },
    alignmentLine:
      "A close, immediate match for your target direction, though it advances the AI side of it more than the leadership side.",
    whyThisReading:
      "Scope overlap with your Fintra work and your remote preference both pull this to Strong, the smaller team and unclear leadership path are the honest offsets.",
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
    id: "insight-opp-5-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-5",
    createdAt: "2026-06-05",
    plainLanguageRead:
      "Tidal wants one generalist to cover both onboarding and rewards for a consumer savings app, breadth over depth, and entirely on-site.",
    expectations: [
      {
        id: "exp-opp-5-1",
        label: "Cover two surfaces as a generalist",
        rationale:
          "Onboarding and rewards are different problems with different metrics. Splitting attention across both limits how deep you go on either.",
      },
      {
        id: "exp-opp-5-2",
        label: "Partner with one product manager for both surfaces",
        rationale:
          "A single PM covering two product areas usually means less dedicated product thinking behind each, more of it falls to design.",
      },
      {
        id: "exp-opp-5-3",
        label: "Work on-site in Ho Chi Minh City",
        rationale:
          "No remote or hybrid option is mentioned anywhere in the listing or the recruiter's outreach.",
      },
    ],
    vagueLanguage: {
      phrase: "generalist product designer across onboarding and rewards",
      decoded:
        "'Generalist' here signals the role has not been scoped into a focused mandate yet. You would likely be asked to backfill wherever the smallest team has the most gaps.",
    },
    whyThisReading:
      "Read from the single-PM structure and the two-surface generalist framing, both signs of a broad, still-forming mandate rather than a focused one.",
    confidence: "Medium",
  },
  {
    id: "insight-opp-5-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-5",
    createdAt: "2026-06-05",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-5-pos-1",
        label: "Company and product are verifiable",
        why: "Tidal has a live app-store presence and roughly 40 employees, both independently checkable.",
      },
    ],
    cautionSignals: [
      {
        id: "cred-opp-5-caution-1",
        label: "Recruiter outreach, not a direct posting",
        why: "Came through recruiter outreach rather than Tidal's own careers page, worth confirming scope directly with the hiring manager before going further.",
      },
    ],
    whyThisReading:
      "Company and product both check out, the recruiter-sourced path is the only reason confidence sits at Medium rather than High.",
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
      "Consumer fintech domain is familiar from your Fintra work, though this role sits outside your target direction.",
    ],
    concerns: [
      "Scope is broad and shallow relative to your current depth, a step back from your Design systems and Interaction design strengths.",
      "On-site only, no path to the Remote work style your preferences call for.",
      "No AI-facing work in the listed scope, off your goal to land a senior or staff AI product design role.",
    ],
    unknowns: [],
    tradeoff: {
      gain: "Fast income stability from a verifiable, currently-hiring company.",
      give: "Ground on your target direction and your remote preference both, this would be a lateral move at best.",
    },
    alignmentLine:
      "Runs counter to your target direction on two counts, on-site only and no AI-facing scope, keeping this a low-priority hold.",
    whyThisReading:
      "The only real positive is domain familiarity, weighed against location and scope working against nearly every stated preference.",
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
    id: "insight-opp-6-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-07-27",
    plainLanguageRead:
      "Meridian wants a senior owner for the console where reviewers judge AI model outputs, specifically how confidence and uncertainty get shown at every decision point.",
    expectations: [
      {
        id: "exp-opp-6-1",
        label: "Own the evaluation console end to end",
        rationale:
          "One designer is accountable for the full reviewer experience, not a single screen inside someone else's console.",
      },
      {
        id: "exp-opp-6-2",
        label: "Define confidence and uncertainty everywhere in the flow",
        rationale:
          "This is not one indicator, the posting asks for a consistent pattern applied across every reviewer decision point in the console.",
      },
      {
        id: "exp-opp-6-3",
        label: "Represent design in the panel loop and roadmap",
        rationale:
          "Design has a seat at planning, not just execution, a signal this role carries real influence over what gets built next.",
      },
      {
        id: "exp-opp-6-4",
        label: "Partner with applied research as methods evolve",
        rationale:
          "Evaluation methods will keep changing as the research team ships new ones, so the console's design needs to flex rather than lock in one pattern.",
      },
    ],
    vagueLanguage: {
      phrase: "how confidence and uncertainty are surfaced to model reviewers",
      decoded:
        "This is the same open design problem as your Fintra explainability panel, just for expert reviewers instead of loan applicants, the underlying trust and legibility challenge does not change.",
    },
    whyThisReading:
      "Read from the console's own scope statement plus the panel-representation detail, both markers of a role with real design authority, not just craft execution.",
    confidence: "High",
  },
  {
    id: "insight-opp-6-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-6",
    createdAt: "2026-05-02",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-6-pos-1",
        label: "Direct referral with hiring-manager contact",
        why: "Came through Fintra's design director, who has spoken to the hiring manager directly, about as verified as a referral gets.",
      },
      {
        id: "cred-opp-6-pos-2",
        label: "Two completed interview rounds match the posting",
        why: "Both rounds so far have covered exactly the scope described in the original listing, with no scope drift.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "A referral with direct hiring-manager contact, confirmed twice over by real interview rounds, this is as verified as a listing gets.",
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
      "Confidence and uncertainty surfacing is nearly identical to the explainability panel you shipped at Fintra, direct evidence for your AI and ML literacy skill.",
      "Global remote role matches your Remote work-style and Ho Chi Minh City location preferences exactly.",
      "Two rounds in with positive feedback, directly advancing your goal to land a senior or staff AI product design role.",
    ],
    concerns: [
      "Panel round will likely probe leadership judgment more than craft, an area with less direct evidence than your People management skill would need.",
    ],
    unknowns: [
      "Final compensation band has not been discussed yet.",
    ],
    tradeoff: {
      gain: "The clearest available match to your target direction, with two rounds of positive signal already banked.",
      give: "A panel round that tests leadership judgment you have not fully proven yet, with pay still unconfirmed.",
    },
    alignmentLine:
      "The single closest match to your target direction of AI product design and leadership currently in motion.",
    whyThisReading:
      "Referral strength, scope overlap, and interview momentum all point the same direction, the leadership-judgment panel is the one real open question left.",
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
    id: "insight-opp-7-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-7",
    createdAt: "2026-04-18",
    plainLanguageRead:
      "Brightpath wants a first-time manager to lead three designers on lending products, a real people-leadership seat, but lighter on the AI-facing work you are prioritizing.",
    expectations: [
      {
        id: "exp-opp-7-1",
        label: "Manage three designers, not just lend craft",
        rationale:
          "This is a people-management mandate first, critique cadence and growth plans are named explicitly alongside the design work.",
      },
      {
        id: "exp-opp-7-2",
        label: "Represent design with product and risk teams",
        rationale:
          "Regulated lending means design decisions get reviewed against risk policy, not just product goals, a slower, more procedural rhythm.",
      },
      {
        id: "exp-opp-7-3",
        label: "Stay hands-on during team ramp-up",
        rationale:
          "Some individual design work continues while the team is small, the manager title does not mean stepping away from craft immediately.",
      },
    ],
    vagueLanguage: {
      phrase: "first-time manager for a three-person design team",
      decoded:
        "'First-time' signals Brightpath expects to invest in ramping you up as a manager, not that you will be thrown in with no support, worth confirming what that onboarding looks like.",
    },
    whyThisReading:
      "Read from the explicit people-management language paired with continued individual design work, both markers of a hybrid manager-plus-individual-contributor seat rather than a pure management role.",
    confidence: "Medium",
  },
  {
    id: "insight-opp-7-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-7",
    createdAt: "2026-04-18",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-7-pos-1",
        label: "Verified recruiter with company history",
        why: "Outreach came from a Brightpath recruiter with a confirmed LinkedIn history at the company, not a third party.",
      },
      {
        id: "cred-opp-7-pos-2",
        label: "Final loop matched the stated team",
        why: "The people you interviewed with in the final round were the same three-person team the posting described.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "Recruiter identity and the final loop's team both confirm this is exactly the opening it was described as.",
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
      "First management scope matches your goal to grow into people leadership directly.",
      "Lending domain overlaps closely with your Fintra work and your Stakeholder and exec communication skill.",
    ],
    concerns: [
      "Lighter on AI-specific work than your goal to land a senior or staff AI product design role calls for.",
      "No formal management experience yet against your People management skill, which the panel likely weighed during the loop.",
    ],
    unknowns: [
      "Decision timeline was not shared at the end of the final loop.",
    ],
    tradeoff: {
      gain: "A real, supported first step into people management, the clearest path to your leadership goal available right now.",
      give: "Time away from the AI-facing work your primary target direction is built around.",
    },
    alignmentLine:
      "Advances your leadership goal directly while running counter to your AI-product goal, a genuine two-direction tradeoff rather than a clean fit.",
    whyThisReading:
      "Management scope is the clear strength here, the missing AI-facing work and unproven People management skill are the honest counterweights.",
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
    id: "insight-opp-8-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-8",
    createdAt: "2026-05-25",
    plainLanguageRead:
      "Orbit is offering ownership of the dispatcher console that regional operations teams use to plan delivery routes, solid operational-tooling scope, but not AI-facing work.",
    expectations: [
      {
        id: "exp-opp-8-1",
        label: "Own the dispatcher console solo",
        rationale:
          "One designer owns the console used by regional operations teams, similar single-owner scope to your Kestrel Analytics dashboard work.",
      },
      {
        id: "exp-opp-8-2",
        label: "Partner with a two-person technical pod",
        rationale:
          "A senior engineer and an operations research analyst are your closest collaborators, a small, technical, data-heavy working group.",
      },
      {
        id: "exp-opp-8-3",
        label: "Travel for quarterly regional research",
        rationale:
          "Research happens in person at dispatcher sites across the region on a quarterly cadence, not remotely or on demand.",
      },
    ],
    vagueLanguage: {
      phrase: "dense, data-heavy console interfaces",
      decoded:
        "This describes the interface complexity you would be responsible for taming, expect a lot of the offer's real difficulty to live in information density, not visual polish.",
    },
    whyThisReading:
      "Read from the console's single-owner framing and the quarterly travel requirement, both concrete signals about day-to-day rhythm rather than vague scope language.",
    confidence: "High",
  },
  {
    id: "insight-opp-8-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-8",
    createdAt: "2026-05-25",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-8-pos-1",
        label: "Sourced from the careers page, confirmed through the loop",
        why: "Every detail in the original posting held through the full interview loop, with the offer matching what was described from the start.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "A full interview loop confirming every detail from the original posting is about as verified as an offer can get.",
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
      "Console-design scope is a clean match for your Kestrel Analytics dashboard experience and your Data storytelling with metrics skill.",
      "Remote APAC role fits your Remote work-style and Ho Chi Minh City location preferences exactly.",
    ],
    concerns: [
      "Less AI-forward than your goal to land a senior or staff AI product design role, this would be a lateral move on that dimension.",
      "Base salary sits at the low end of the compensation your preferences target for senior or staff-level scope.",
    ],
    unknowns: [],
    tradeoff: {
      gain: "A confirmed offer with strong operational-tooling scope and your preferred remote work style.",
      give: "Ground on your AI-product goal, and pay at the low end of your target range.",
    },
    alignmentLine:
      "Solid on craft and preferences, but a step sideways from your target direction of AI product design and leadership.",
    whyThisReading:
      "Scope and remote fit are genuinely strong, the AI-direction gap and below-target pay are the real tradeoffs behind this offer.",
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
    id: "insight-opp-9-interpretation",
    kind: "interpretation",
    hostType: "opportunity",
    hostId: "opp-9",
    createdAt: "2026-04-02",
    plainLanguageRead:
      "Vela staffs designers onto short-term US-hours client engagements, agency pace and variety, but with a client roster that turns over faster than any single body of work can build depth.",
    expectations: [
      {
        id: "exp-opp-9-1",
        label: "Rotate across two to three client engagements",
        rationale:
          "Work is split across concurrent clients rather than one product, portfolio breadth comes at the cost of depth on any one story.",
      },
      {
        id: "exp-opp-9-2",
        label: "Deliver end to end on compressed timelines",
        rationale:
          "Agency-style delivery compresses discovery through shipping into shorter cycles than an in-house product team would allow.",
      },
      {
        id: "exp-opp-9-3",
        label: "Overlap meaningfully with US business hours",
        rationale:
          "This is not occasional overlap, it is a real schedule shift from Ho Chi Minh City hours, the detail that ultimately ended this one.",
      },
    ],
    vagueLanguage: {
      phrase: "short-term client engagements",
      decoded:
        "'Short-term' understates it, the posting does not say client relationships typically last only a few months before rotating to the next one.",
    },
    whyThisReading:
      "Read from the rotation cadence and the timezone requirement stated plainly in the posting, no ambiguity here, the fit issue was always the schedule, not the description.",
    confidence: "High",
  },
  {
    id: "insight-opp-9-credibility",
    kind: "credibility",
    hostType: "opportunity",
    hostId: "opp-9",
    createdAt: "2026-04-02",
    verdict: "pass",
    positiveSignals: [
      {
        id: "cred-opp-9-pos-1",
        label: "Agency and client roster are verifiable",
        why: "Vela's current client list and 30-person headcount are both independently confirmable.",
      },
    ],
    cautionSignals: [],
    whyThisReading:
      "Nothing about the agency or its clients raised a flag, the schedule mismatch that closed this one was a fit problem, not a credibility problem.",
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
      "Agency pace matches the fast turnaround you handled at Bambu Studio, real evidence behind your Prototyping skill.",
    ],
    concerns: [
      "US-hours overlap proved unworkable alongside your Ho Chi Minh City-based schedule preference.",
      "Short-term client staffing offers little continuity toward your goal to land a senior or staff AI product design role.",
    ],
    unknowns: [],
    tradeoff: {
      gain: "Fast-paced variety across multiple clients.",
      give: "Any continuity toward your target direction, and a schedule compatible with your Ho Chi Minh City preference.",
    },
    alignmentLine:
      "Withdrawn before it could test alignment with your target direction, the timezone mismatch settled it first.",
    whyThisReading:
      "The schedule conflict was decisive on its own, continuity concerns toward your target direction were a secondary factor.",
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
