import { cvForkedSurface, opportunityForkedSurface } from "@/lib/copilot-surface-names";
import { COPILOT_CAPTURE_CANDIDATE_ID } from "@/lib/data/track-record";
import { recruiterCopilotScripts } from "@/lib/data/recruiter/copilot-scripts";
import type { CopilotSurfaceScript } from "@/lib/types";

// The Copilot layer's one script registry: every surface's suggested
// prompts and scripted exchanges, for the right panel everywhere it opens.
// A surface is forked (a ":" suffix naming the specific object) only where
// the scripted content genuinely differs per instance, opportunities (fit
// judgment) and CVs (tailoring guidance); everything else shares one surface
// per type. Every exchange's response renders as a structured block: a short
// lead line, optional labeled points, a confidence chip only where a
// judgment is made, and exactly one of a store-wired action or a handoff.
// Surface: components/shell/copilot-panel.tsx, on every route that calls
// useCopilotSurface (see lib/copilot-surface-names.ts for the forked-surface
// naming rule).
export const copilotScripts: CopilotSurfaceScript[] = [
  {
    surface: "Home",
    suggestedPrompts: [
      "What should I focus on this week?",
      "Which opportunity needs attention right now?",
      "Summarize what changed since last week.",
    ],
    exchanges: [
      {
        id: "copilot-home-1",
        prompt: "What should I focus on this week?",
        response: {
          lead: "Meridian Labs and Orbit Logistics, in that order.",
          points: [
            {
              label: "Meridian Labs",
              detail: "Nearest deadline and your strongest AI-direction match, prep for the panel round first.",
            },
            {
              label: "Orbit Logistics",
              detail: "The offer window is closing, worth a compensation decision before it lapses.",
            },
          ],
          confidence: "High",
          handoff: { kind: "route", href: "/opportunities/opp-6#actions", label: "Open Meridian Labs" },
        },
      },
      {
        id: "copilot-home-2",
        prompt: "Which opportunity needs attention right now?",
        response: {
          lead: "Solace AI.",
          points: [
            {
              label: "Why it's first",
              detail: "A Dream, Strong-fit match with a warm referral, saved 8 weeks ago with no message sent yet.",
            },
            {
              label: "Open item",
              detail:
                "The accepted next action to send your case study is still outstanding, and Duy Nguyen's email checked in about it an hour ago.",
            },
          ],
          handoff: { kind: "route", href: "/opportunities/opp-1", label: "Open Solace AI" },
        },
      },
      {
        id: "copilot-home-3",
        prompt: "Summarize what changed since last week.",
        response: {
          lead: "Three opportunities moved, and 2 Track Record candidates were drafted.",
          points: [
            { label: "Meridian Labs", detail: "Advanced to the panel round." },
            { label: "Halo Bank", detail: "Final loop wrapped, decision pending." },
            { label: "Orbit Logistics", detail: "Extended an offer." },
          ],
          handoff: { kind: "route", href: "/track-record", label: "Review drafted candidates" },
        },
      },
    ],
  },
  {
    surface: "Opportunities",
    suggestedPrompts: [
      "Which of these have the strongest fit?",
      "What's stale and worth archiving?",
      "Help me add a new opportunity from a link.",
    ],
    exchanges: [
      {
        id: "copilot-opportunities-1",
        prompt: "Which of these have the strongest fit?",
        response: {
          lead: "Solace AI, Arclight AI, Meridian Labs, and Orbit Logistics are all rated Strong.",
          points: [
            {
              label: "Closest to your direction",
              detail: "Solace AI and Meridian Labs are the closest matches to AI product design specifically.",
            },
          ],
          confidence: "High",
          handoff: { kind: "route", href: "/opportunities/opp-1", label: "Open Solace AI" },
        },
      },
      {
        id: "copilot-opportunities-2",
        prompt: "What's stale and worth archiving?",
        response: {
          lead: "Mekong Robotics, it hasn't moved in 11 weeks.",
          points: [
            {
              label: "The call",
              detail: "Move it to Applied this week or archive it, it's the one saved role without a clear next step.",
            },
          ],
          action: {
            kind: "accept-next-action",
            targetId: "action-6",
            label: "Accept: Decide on Mekong Robotics",
          },
        },
      },
      {
        id: "copilot-opportunities-3",
        prompt: "Help me add a new opportunity from a link.",
        response: {
          lead: "Paste the job link or description into the Add dialog's first tab.",
          points: [
            {
              label: "What happens next",
              detail: "Copilot parses it into role, company, location, and salary fields for you to review before it's saved.",
            },
          ],
          handoff: { kind: "route", href: "/opportunities", label: "Open the Add dialog" },
        },
      },
    ],
  },
  {
    surface: "Opportunity Detail",
    suggestedPrompts: [
      "Why is the fit rated the way it is?",
      "What should my next step be here?",
      "Draft a message to follow up.",
    ],
    exchanges: [
      {
        id: "copilot-opportunity-detail-1",
        prompt: "Why is the fit rated the way it is?",
        response: {
          lead: "This role's core scope overlaps closely with work you've already shipped, that's the main driver of the rating.",
          points: [
            { label: "See the detail", detail: "The AI Analysis tab breaks down the specific strengths, concerns, and unknowns behind it." },
          ],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "Open AI Analysis" },
        },
      },
      {
        id: "copilot-opportunity-detail-2",
        prompt: "What should my next step be here?",
        response: {
          lead: "The Actions tab has a suggested next step with a one-line rationale.",
          points: [
            { label: "Your call", detail: "Accept it as is, edit it, or dismiss it, nothing happens automatically either way." },
          ],
          handoff: { kind: "opportunity-tab", tab: "actions", label: "Open Actions tab" },
        },
      },
      {
        id: "copilot-opportunity-detail-3",
        prompt: "Draft a message to follow up.",
        response: {
          lead: "Something like: \"Hi, following up on my application, still very interested and happy to share more detail on my explainability work if useful.\"",
          points: [{ label: "Before sending", detail: "Edit the specifics first, nothing sends automatically." }],
          handoff: { kind: "opportunity-tab", tab: "actions", label: "Open Actions tab" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Solace AI"),
    suggestedPrompts: [
      "What does 'trustworthy interface patterns' actually mean here?",
      "How much weight should I put on the referral?",
      "What should I lead with in my case study for this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-1-1",
        prompt: "What does 'trustworthy interface patterns' actually mean here?",
        response: {
          lead: "You'd be designing the visual language for model confidence and uncertainty from scratch.",
          points: [{ label: "No existing pattern", detail: "Solace doesn't have one yet, expect to invent it, not adapt one." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the full interpretation" },
        },
      },
      {
        id: "copilot-opp-1-2",
        prompt: "How much weight should I put on the referral?",
        response: {
          lead: "A lot.",
          points: [
            {
              label: "Why",
              detail: "Your contact has worked directly with Solace's design team, a credible internal voice, not just a secondhand tip.",
            },
            {
              label: "Recent signal",
              detail: "Duy Nguyen's email an hour ago confirms the role is still open and he's ready to route your case study.",
            },
          ],
          confidence: "High",
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the credibility check" },
        },
      },
      {
        id: "copilot-opp-1-3",
        prompt: "What should I lead with in my case study for this one?",
        response: {
          lead: "Lead with the explainability panel from Fintra first.",
          points: [
            { label: "Why this one", detail: "It's the single piece of evidence that maps most directly onto owning Solace's explainability layer." },
          ],
          handoff: { kind: "opportunity-tab", tab: "materials", label: "Open Materials to tailor your CV" },
        },
      },
      {
        id: "copilot-opp-1-research",
        prompt: "Give me a research summary on Solace AI",
        response: {
          lead: "Solace's engineering blog and their VP of Product's talks focus heavily on model-explainability for clinical decision support.",
          points: [
            {
              label: "Most relevant",
              detail: "Their June 2026 post on rendering model confidence for non-technical clinicians is a close match for this role's explainability layer.",
            },
          ],
          handoff: { kind: "opportunity-tab", tab: "materials", label: "Tailor your CV with this angle" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Vanta Growth Labs"),
    suggestedPrompts: [
      "Is this posting worth pursuing at all?",
      "What would it take to clear the credibility flag?",
      "Why is fit marked Unknown instead of Weak?",
    ],
    exchanges: [
      {
        id: "copilot-opp-2-1",
        prompt: "Is this posting worth pursuing at all?",
        response: {
          lead: "Not yet.",
          points: [
            { label: "Three checks failed", detail: "Company presence, named team, and product description all came back empty." },
          ],
          action: {
            kind: "accept-next-action",
            targetId: "action-7",
            label: "Accept: Confirm a real hiring contact",
          },
        },
      },
      {
        id: "copilot-opp-2-2",
        prompt: "What would it take to clear the credibility flag?",
        response: {
          lead: "A real hiring manager or employee you can verify on LinkedIn, or a company site with more than one unregistered-looking domain page.",
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the credibility signals" },
        },
      },
      {
        id: "copilot-opp-2-3",
        prompt: "Why is fit marked Unknown instead of Weak?",
        response: {
          lead: "Unknown means there isn't enough verified information to judge fit responsibly yet.",
          points: [{ label: "Why not Weak", detail: "Weak would mean the role was checked and ruled out, and that hasn't happened here." }],
          confidence: "Medium",
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Mekong Robotics"),
    suggestedPrompts: [
      "Should I keep this one active or archive it?",
      "Why does mentoring count toward fit here?",
      "What's the biggest gap against my target direction?",
    ],
    exchanges: [
      {
        id: "copilot-opp-3-1",
        prompt: "Should I keep this one active or archive it?",
        response: {
          lead: "Worth one more check before deciding.",
          points: [
            { label: "Why", detail: "Eleven weeks with no update means it's either stalled or deprioritized, ask directly rather than keep waiting." },
          ],
          action: {
            kind: "accept-next-action",
            targetId: "action-6",
            label: "Accept: Decide on Mekong Robotics",
          },
        },
      },
      {
        id: "copilot-opp-3-2",
        prompt: "Why does mentoring count toward fit here?",
        response: {
          lead: "Because the lead scope names mentoring two designers explicitly.",
          points: [{ label: "Why it counts", detail: "Real progress toward your goal to grow into people leadership, even outside your primary AI direction." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
      {
        id: "copilot-opp-3-3",
        prompt: "What's the biggest gap against my target direction?",
        response: {
          lead: "No AI or model-facing work anywhere in the listed scope.",
          points: [{ label: "Clearest gap", detail: "Against your target direction of AI product design and leadership." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
      {
        id: "copilot-opp-3-research",
        prompt: "Give me a research summary on Mekong Robotics",
        response: {
          lead: "Mekong's last two product announcements focus on fleet-routing efficiency for their existing dashboard, not a new hardware line.",
          points: [
            {
              label: "Reading",
              detail: "A sign the 11-week-old posting is likely still active rather than stalled, though no new hiring-manager name has surfaced publicly.",
            },
          ],
          handoff: { kind: "opportunity-tab", tab: "actions", label: "Decide next step" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Arclight AI"),
    suggestedPrompts: [
      "How is this different from Meridian Labs?",
      "What's the biggest risk if I get an offer here?",
      "Why is the team size listed as a concern?",
    ],
    exchanges: [
      {
        id: "copilot-opp-4-1",
        prompt: "How is this different from Meridian Labs?",
        response: {
          lead: "Arclight is about the suggestion-and-approval interaction itself, workflow automation for operations teams.",
          points: [{ label: "Meridian, by contrast", detail: "Reviewer-facing confidence and uncertainty for evaluating models. Both are trust-boundary work, different audiences." }],
          handoff: { kind: "route", href: "/opportunities/opp-6", label: "Compare with Meridian Labs" },
        },
      },
      {
        id: "copilot-opp-4-2",
        prompt: "What's the biggest risk if I get an offer here?",
        response: {
          lead: "The unclear path to design leadership as the team grows.",
          points: [{ label: "Worth doing first", detail: "Ask directly in a follow-up conversation before you'd need to decide on an offer." }],
          action: {
            kind: "accept-next-action",
            targetId: "action-2",
            label: "Accept: Follow up on application status",
          },
        },
      },
      {
        id: "copilot-opp-4-3",
        prompt: "Why is the team size listed as a concern?",
        response: {
          lead: "A three-person pod is efficient day to day but has less slack for structured mentorship.",
          points: [{ label: "Why it matters", detail: "That slack is what your goal to grow into people leadership actually needs." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Lotus Finance"),
    suggestedPrompts: [
      "Why is this rated Weak instead of Medium?",
      "Is the on-site requirement really a dealbreaker?",
      "What would change my mind about this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-5-1",
        prompt: "Why is this rated Weak instead of Medium?",
        response: {
          lead: "Three things stack against it at once.",
          points: [
            { label: "Stacked concerns", detail: "Broad-shallow scope, on-site only, and no AI-facing work. Any one alone might land at Medium, together they pull it to Weak." },
          ],
          confidence: "High",
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
      {
        id: "copilot-opp-5-2",
        prompt: "Is the on-site requirement really a dealbreaker?",
        response: {
          lead: "It's your call, but it runs directly against your Remote work-style preference.",
          points: [{ label: "No hybrid option", detail: "There's no hybrid option mentioned anywhere in the listing." }],
          action: {
            kind: "accept-next-action",
            targetId: "action-8",
            label: "Accept: Decide on withdrawing",
          },
        },
      },
      {
        id: "copilot-opp-5-3",
        prompt: "What would change my mind about this one?",
        response: {
          lead: "A narrower scope on one surface, or a path to remote work.",
          points: [{ label: "Either one", detail: "Would meaningfully change the read here." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Meridian Labs"),
    suggestedPrompts: [
      "What should I focus on for the panel round?",
      "How confident are we in the Strong rating?",
      "What's still unknown about this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-6-1",
        prompt: "What should I focus on for the panel round?",
        response: {
          lead: "Leadership judgment, that's what the panel is most likely to probe next.",
          points: [
            { label: "Where to spend prep time", detail: "Your craft evidence is already strong, spend prep time on decisions and tradeoffs, not portfolio polish." },
            {
              label: "New from the recruiter",
              detail: "Jordan Ellis's email 2 hours ago adds a specific ask: a ten-minute case-study walkthrough instead of open Q&A.",
            },
          ],
          handoff: { kind: "opportunity-tab", tab: "actions", label: "Open Actions tab" },
        },
      },
      {
        id: "copilot-opp-6-2",
        prompt: "How confident are we in the Strong rating?",
        response: {
          lead: "High.",
          points: [
            {
              label: "Why",
              detail: "A referral with direct hiring-manager contact, two rounds matching the original posting, and console scope nearly identical to your Fintra explainability panel.",
            },
          ],
          confidence: "High",
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
      {
        id: "copilot-opp-6-3",
        prompt: "What's still unknown about this one?",
        response: {
          lead: "Final compensation band hasn't been discussed yet.",
          points: [{ label: "What's left", detail: "That's the one open item before an offer decision." }],
          handoff: { kind: "route", href: "/cvs/cv-3", label: "Review the tailored CV" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Halo Bank"),
    suggestedPrompts: [
      "Is the management scope worth the AI tradeoff?",
      "What should I ask about the decision timeline?",
      "How does this compare to my other Interview-stage role?",
    ],
    exchanges: [
      {
        id: "copilot-opp-7-1",
        prompt: "Is the management scope worth the AI tradeoff?",
        response: {
          lead: "That's the real tradeoff to weigh: people-leadership progress against time away from your AI-product goal.",
          points: [{ label: "Neither is wrong", detail: "It depends which you want to prioritize next." }],
          handoff: { kind: "route", href: "/goals", label: "See the goals tension" },
        },
      },
      {
        id: "copilot-opp-7-2",
        prompt: "What should I ask about the decision timeline?",
        response: {
          lead: "Ask directly when the committee expects to decide.",
          points: [
            { label: "Why now", detail: "The final loop wrapped without a stated timeline, it's the one unknown left." },
            {
              label: "Fresh signal",
              detail: "Thao Bui's email 5 hours ago already asks for a follow-up call this Friday, a good moment to ask directly.",
            },
          ],
          action: {
            kind: "accept-next-action",
            targetId: "action-9",
            label: "Accept: Ask for a decision timeline",
          },
        },
      },
      {
        id: "copilot-opp-7-3",
        prompt: "How does this compare to my other Interview-stage role?",
        response: {
          lead: "Meridian Labs is your stronger AI-direction match, Halo is your stronger leadership match.",
          points: [{ label: "By design", detail: "They're pulling in different directions on purpose." }],
          handoff: { kind: "route", href: "/opportunities/opp-6", label: "Compare with Meridian Labs" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Orbit Logistics"),
    suggestedPrompts: [
      "Should I negotiate on the base salary?",
      "How does this offer compare to my target direction?",
      "What's the honest tradeoff here?",
    ],
    exchanges: [
      {
        id: "copilot-opp-8-1",
        prompt: "Should I negotiate on the base salary?",
        response: {
          lead: "Worth trying.",
          points: [{ label: "Why", detail: "The concern notes it sits at the low end of your target range, exactly the kind of gap worth raising before you accept." }],
          action: {
            kind: "accept-next-action",
            targetId: "action-5",
            label: "Accept: Review the offer terms",
          },
        },
      },
      {
        id: "copilot-opp-8-2",
        prompt: "How does this offer compare to my target direction?",
        response: {
          lead: "It's a lateral move on the AI dimension specifically.",
          points: [{ label: "Tradeoff", detail: "Strong on craft and your remote preference, but not advancing your goal to land a senior or staff AI product design role." }],
          handoff: { kind: "route", href: "/goals", label: "See target direction" },
        },
      },
      {
        id: "copilot-opp-8-3",
        prompt: "What's the honest tradeoff here?",
        response: {
          lead: "You'd gain a confirmed offer with scope you're already good at.",
          points: [{ label: "You'd give up", detail: "Ground on your AI-direction goal, and below-target pay unless you negotiate." }],
          confidence: "Medium",
          handoff: { kind: "opportunity-tab", tab: "actions", label: "Open Actions tab" },
        },
      },
    ],
  },
  {
    surface: opportunityForkedSurface("Vela Studio"),
    suggestedPrompts: [
      "Why did this end up Closed?",
      "Was withdrawing the right call?",
      "What would make a similar agency role work next time?",
    ],
    exchanges: [
      {
        id: "copilot-opp-9-1",
        prompt: "Why did this end up Closed?",
        response: {
          lead: "Timezone overlap with the US team proved unworkable against your Ho Chi Minh City schedule.",
          points: [{ label: "Not a fit or credibility issue", detail: "That's the specific reason logged." }],
          handoff: { kind: "opportunity-tab", tab: "activity", label: "See the activity log" },
        },
      },
      {
        id: "copilot-opp-9-2",
        prompt: "Was withdrawing the right call?",
        response: {
          lead: "Yes.",
          points: [{ label: "Why", detail: "Continuing past the first screen meant testing an incompatible schedule further, with little upside toward your target direction." }],
          handoff: { kind: "opportunity-tab", tab: "ai-analysis", label: "See the fit judgment" },
        },
      },
      {
        id: "copilot-opp-9-3",
        prompt: "What would make a similar agency role work next time?",
        response: {
          lead: "APAC or Ho Chi Minh City-hours client work specifically.",
          points: [{ label: "What wasn't the problem", detail: "The agency model itself, the timezone was the issue." }],
          handoff: { kind: "route", href: "/opportunities", label: "Back to Opportunities" },
        },
      },
    ],
  },
  {
    surface: "Profile",
    suggestedPrompts: [
      "What do you use from my profile when judging fit?",
      "What should I update before applying more broadly?",
      "What's missing from my profile?",
    ],
    exchanges: [
      {
        id: "copilot-profile-1",
        prompt: "What do you use from my profile when judging fit?",
        response: {
          lead: "Mainly your target direction, strengths, and specific experience entries.",
          points: [
            { label: "Strongest signal", detail: "The Fintra explainability work, the strongest evidence for the AI-direction roles you're pursuing." },
          ],
          handoff: { kind: "route", href: "/opportunities", label: "See fit judgments" },
        },
      },
      {
        id: "copilot-profile-2",
        prompt: "What should I update before applying more broadly?",
        response: {
          lead: "Your summary still leads with general fintech breadth.",
          points: [
            { label: "Better lead", detail: "Leading with the explainability panel work would better match the AI-forward roles you're prioritizing right now." },
          ],
          handoff: { kind: "route", href: "/cvs/cv-1", label: "Open Base CV" },
        },
      },
      {
        id: "copilot-profile-3",
        prompt: "What's missing from my profile?",
        response: {
          lead: "Two things: no compensation history captured, and public speaking evidence isn't reflected yet.",
          points: [
            { label: "Public speaking", detail: "Skills & Learning already tracks it as a gap, but your Strengths list doesn't mention the meetup talk from Track Record." },
          ],
          handoff: { kind: "route", href: "/skills", label: "See the public speaking gap" },
        },
      },
    ],
  },
  {
    surface: "CV Versions",
    suggestedPrompts: [
      "Which CV should I use for an AI-focused role?",
      "Tailor my base CV for a new opportunity.",
      "What's the difference between my CV versions?",
    ],
    exchanges: [
      {
        id: "copilot-cvs-1",
        prompt: "Which CV should I use for an AI-focused role?",
        response: {
          lead: "Start from Base CV and tailor it, the way the Meridian Labs version leads with your explainability panel work.",
          points: [{ label: "For management-first roles", detail: "Product-lead CV is better suited when management scope is the primary ask." }],
          handoff: { kind: "route", href: "/cvs/cv-3", label: "See the tailored example" },
        },
      },
      {
        id: "copilot-cvs-2",
        prompt: "Tailor my base CV for a new opportunity.",
        response: {
          lead: "Link a base CV to the opportunity from its Materials tab, then choose Tailor for this role.",
          points: [{ label: "What happens next", detail: "Copilot suggests section-by-section changes for you to accept, edit, or dismiss." }],
          handoff: { kind: "route", href: "/opportunities", label: "Pick a target opportunity" },
        },
      },
      {
        id: "copilot-cvs-3",
        prompt: "What's the difference between my CV versions?",
        response: {
          lead: "Three versions, each pitched differently.",
          points: [
            { label: "Base CV", detail: "General-purpose, fintech breadth first." },
            { label: "Product-lead CV", detail: "Leads with mentoring and the design-system rollout, for management-first roles." },
            { label: "Meridian Labs, tailored", detail: "Rewritten to lead with the explainability panel for one specific opportunity." },
          ],
          handoff: { kind: "route", href: "/cvs/cv-2", label: "Open Product-lead CV" },
        },
      },
    ],
  },
  {
    surface: cvForkedSurface("Base CV"),
    suggestedPrompts: [
      "What should I strengthen in this CV for an AI-focused role?",
      "Who is this CV best used for right now?",
      "Should I tailor this before applying somewhere new?",
    ],
    exchanges: [
      {
        id: "copilot-cv-1-1",
        prompt: "What should I strengthen in this CV for an AI-focused role?",
        response: {
          lead: "The summary leads with general fintech breadth, not the explainability work AI-forward roles care about most.",
          points: [{ label: "Fix", detail: "Reorder the summary to open with the AI underwriting explainability panel, the way the Meridian Labs tailored version does." }],
          handoff: { kind: "route", href: "/cvs/cv-3", label: "See how the tailored version reorders this" },
        },
      },
      {
        id: "copilot-cv-1-2",
        prompt: "Who is this CV best used for right now?",
        response: {
          lead: "The general-purpose starting point, best for any role you haven't tailored a version for yet.",
          handoff: { kind: "route", href: "/opportunities", label: "Pick a target opportunity" },
        },
      },
      {
        id: "copilot-cv-1-3",
        prompt: "Should I tailor this before applying somewhere new?",
        response: {
          lead: "Yes, for anything AI-forward.",
          points: [{ label: "Good candidate", detail: "Solace AI doesn't have a linked CV yet, and it's your top Dream match." }],
          handoff: { kind: "route", href: "/opportunities/opp-1#materials", label: "Open Materials for Solace AI" },
        },
      },
    ],
  },
  {
    surface: cvForkedSurface("Product-lead CV"),
    suggestedPrompts: [
      "What should I strengthen in this CV for a design-lead role?",
      "Who is this CV best used for right now?",
      "Does this cover enough AI-specific work?",
    ],
    exchanges: [
      {
        id: "copilot-cv-2-1",
        prompt: "What should I strengthen in this CV for a design-lead role?",
        response: {
          lead: "The Leadership highlights section is strong, but it doesn't name any AI-specific scope.",
          points: [{ label: "Worth adding", detail: "A line connecting your mentoring and design-system work to AI-forward product teams, if you use this for an AI-adjacent role." }],
          handoff: { kind: "route", href: "/opportunities/opp-7", label: "Open Halo Bank" },
        },
      },
      {
        id: "copilot-cv-2-2",
        prompt: "Who is this CV best used for right now?",
        response: {
          lead: "Roles where management scope is the primary ask, like Halo Bank's Product Design Manager role.",
          handoff: { kind: "route", href: "/opportunities/opp-7", label: "Open Halo Bank" },
        },
      },
      {
        id: "copilot-cv-2-3",
        prompt: "Does this cover enough AI-specific work?",
        response: {
          lead: "Not yet, it leans entirely on leadership evidence.",
          points: [{ label: "Gap", detail: "No AI or model-facing work named anywhere in this version." }],
          confidence: "Medium",
          handoff: { kind: "route", href: "/skills", label: "See the AI fluency gap" },
        },
      },
    ],
  },
  {
    surface: cvForkedSurface("Meridian Labs, tailored"),
    suggestedPrompts: [
      "What was changed from Base CV for this role?",
      "Is this still the strongest version for the panel round?",
      "What should I strengthen further before the panel?",
    ],
    exchanges: [
      {
        id: "copilot-cv-3-1",
        prompt: "What was changed from Base CV for this role?",
        response: {
          lead: "The summary and experience sections were rewritten to lead with the explainability panel.",
          points: [{ label: "New section", detail: "\"Relevant to this role\" was added, naming the trust-boundary discovery sprint directly." }],
          handoff: { kind: "route", href: "/opportunities/opp-6", label: "Open Meridian Labs" },
        },
      },
      {
        id: "copilot-cv-3-2",
        prompt: "Is this still the strongest version for the panel round?",
        response: {
          lead: "Yes.",
          points: [{ label: "Why", detail: "It's the version most closely mapped to Meridian's evaluation console scope." }],
          confidence: "High",
          handoff: { kind: "route", href: "/opportunities/opp-6#actions", label: "Open Actions tab" },
        },
      },
      {
        id: "copilot-cv-3-3",
        prompt: "What should I strengthen further before the panel?",
        response: {
          lead: "The CV itself is in good shape, the open gap is leadership judgment, not craft.",
          points: [{ label: "Where to focus instead", detail: "Prep talking points on decisions and tradeoffs, that's what the panel is likely to probe next." }],
          handoff: { kind: "route", href: "/goals", label: "See the leadership goal" },
        },
      },
    ],
  },
  {
    surface: "Track Record",
    suggestedPrompts: [
      "What should I confirm from this week?",
      "Which entries best support my AI direction?",
      "What is worth capturing from last month?",
    ],
    exchanges: [
      {
        id: "copilot-track-record-1",
        prompt: "What should I confirm from this week?",
        response: {
          lead: "Two drafted candidates: the credibility-check heuristic from Tuesday's AI review sync, and the trust-cue research sprint.",
          points: [
            { label: "Why now", detail: "Both are already referenced elsewhere this week, worth confirming while details are fresh." },
            {
              label: "Source",
              detail: "Ravi Desai's and Hana Kobayashi's recap emails back each one, both show up as evidence chips on the drafts.",
            },
          ],
          handoff: { kind: "route", href: "/skills", label: "See the AI fluency connection" },
        },
      },
      {
        id: "copilot-track-record-2",
        prompt: "Which entries best support my AI direction?",
        response: {
          lead: "The explainability panel launch and the AI assistant discovery sprint are your strongest evidence.",
          points: [{ label: "Already linked", detail: "Both are already linked to your AI and ML literacy skill." }],
          handoff: { kind: "route", href: "/goals", label: "See goal-1's progress" },
        },
      },
      {
        id: "copilot-track-record-3",
        prompt: "What is worth capturing from last month?",
        response: {
          lead: "Running three senior-level interview loops to a decision point at once, that's not captured anywhere yet.",
          points: [
            {
              label: "Why it's worth it",
              detail: "Meridian Labs, Halo Bank, and Orbit Logistics all reached a decision point in the same four-week window.",
            },
          ],
          action: {
            kind: "create-candidate-entry",
            entryId: COPILOT_CAPTURE_CANDIDATE_ID,
            label: "Draft this as a candidate",
          },
        },
      },
    ],
  },
  {
    surface: "Proof Builder",
    suggestedPrompts: [
      "Which of my claims need stronger proof?",
      "What's my strongest unused evidence?",
      "How does accepting a proof transformation work?",
    ],
    exchanges: [
      {
        id: "copilot-proof-1",
        prompt: "Which of my claims need stronger proof?",
        response: {
          lead: "Your profile summary and one strength are the thinnest right now.",
          points: [
            { label: "Profile summary", detail: "Names your Fintra work but doesn't cite a specific number yet." },
            {
              label: "\"Coaches junior designers...\"",
              detail: "No Track Record entry linked yet, even though the mentoring outcome already exists.",
            },
          ],
          confidence: "High",
          handoff: { kind: "route", href: "/proof?context=profile", label: "Verify profile claims" },
        },
      },
      {
        id: "copilot-proof-2",
        prompt: "What's my strongest unused evidence?",
        response: {
          lead: "The loan-onboarding redesign and the AI assistant discovery sprint are your strongest entries not yet cited everywhere they could be.",
          points: [
            {
              label: "Loan-onboarding redesign",
              detail: "Cut drop-off 18 percent, not yet cited on the Meridian Labs tailored CV.",
            },
            {
              label: "AI assistant discovery sprint",
              detail: "Defines the trust-boundary spec, not yet positioned on Solace AI.",
            },
          ],
          handoff: { kind: "route", href: "/proof", label: "Open Proof Builder" },
        },
      },
      {
        id: "copilot-proof-3",
        prompt: "How does accepting a proof transformation work?",
        response: {
          lead: "Accepting writes the grounded proof straight to its real target, and always shows what changed with an Undo.",
          points: [
            { label: "CV context", detail: "Updates the CV section, visible immediately on that CV's own page." },
            { label: "Profile context", detail: "Updates your summary or a strength's evidence note." },
            {
              label: "Opportunity or path context",
              detail: "Adds a positioning note to Materials, or pins a \"prove it\" item into your growth plan.",
            },
          ],
        },
      },
    ],
  },
  {
    surface: "Goals",
    suggestedPrompts: [
      "Am I on track for my AI product design goal?",
      "What's the gap analysis showing me?",
      "Is my pipeline aligned with my target direction?",
    ],
    exchanges: [
      {
        id: "copilot-goals-1",
        prompt: "Am I on track for my AI product design goal?",
        response: {
          lead: "Yes, on track.",
          points: [
            { label: "Evidence", detail: "Three strong-fit opportunities are active against it, and Meridian Labs is a near-exact scope match." },
            { label: "Watch", detail: "The case study goal supporting it is behind schedule." },
          ],
          confidence: "High",
          handoff: { kind: "route", href: "/opportunities/opp-6", label: "Open Meridian Labs" },
        },
      },
      {
        id: "copilot-goals-2",
        prompt: "What's the gap analysis showing me?",
        response: {
          lead: "The same 4 skill gaps as the Skills page.",
          points: [
            { label: "Gaps", detail: "AI and ML literacy, AI interaction design, people management, and public speaking." },
            { label: "Coverage", detail: "All 4 already have a learning item suggested." },
          ],
          handoff: { kind: "route", href: "/skills", label: "Open Skills & Learning" },
        },
      },
      {
        id: "copilot-goals-3",
        prompt: "Is my pipeline aligned with my target direction?",
        response: {
          lead: "Mostly, with one real tension.",
          points: [
            { label: "Aligned", detail: "Land a senior or staff AI product design role is on track, backed by 3 active strong-fit opportunities." },
            { label: "Tension", detail: "Grow into people leadership needs attention, and Halo Bank pulls toward management over AI depth." },
          ],
          confidence: "Medium",
          handoff: { kind: "route", href: "/opportunities", label: "Review the pipeline" },
        },
      },
    ],
  },
  {
    surface: "Skills & Learning",
    suggestedPrompts: [
      "Which skill should I learn first?",
      "What learning items are already planned?",
      "How do my skills compare to what active opportunities require?",
    ],
    exchanges: [
      {
        id: "copilot-skills-1",
        prompt: "Which skill should I learn first?",
        response: {
          lead: "AI and ML literacy, it's the gap most directly blocking your target direction.",
          points: [{ label: "Timing", detail: "It's also the one with the most upcoming panel exposure at Meridian Labs." }],
          action: {
            kind: "add-learning-item",
            targetId: "li-1",
            label: "Accept: AI Product Design Fundamentals course",
          },
        },
      },
      {
        id: "copilot-skills-2",
        prompt: "What learning items are already planned?",
        response: {
          lead: "Two are planned: shipping a small AI-assisted side project, and the quarterly public case study habit.",
          points: [{ label: "Rest", detail: "The rest are still suggested, waiting on you to accept them." }],
          handoff: { kind: "route", href: "/goals", label: "See linked goals" },
        },
      },
      {
        id: "copilot-skills-3",
        prompt: "How do my skills compare to what active opportunities require?",
        response: {
          lead: "AI and ML literacy and AI interaction design are named directly by Solace AI, Mekong Robotics, Meridian Labs, and Arclight AI.",
          points: [{ label: "Reading", detail: "Both are gaps at Working against a targeted Strong, the clearest overlap between your pipeline and your learning plan." }],
          handoff: { kind: "route", href: "/opportunities", label: "See related opportunities" },
        },
      },
    ],
  },
  {
    surface: "Path Planner",
    suggestedPrompts: [
      "Why is this the recommended path?",
      "What would change the ranking?",
      "What's the single next move?",
    ],
    exchanges: [
      {
        id: "copilot-planner-1",
        prompt: "Why is this the recommended path?",
        response: {
          lead: "Three of your four Strong-fit opportunities already sit in this exact lane.",
          points: [
            { label: "Evidence", detail: "Solace AI, Arclight AI, and Meridian Labs all lean on the same explainability work you already ship at Fintra." },
            { label: "Cost", detail: "Pursuing it costs nothing you aren't already doing, every active AI-forward loop stays exactly where it is." },
          ],
          confidence: "High",
        },
      },
      {
        id: "copilot-planner-2",
        prompt: "What would change the ranking?",
        response: {
          lead: "A Meridian Labs offer would lock this path in. A Halo Bank acceptance paired with a stalled AI-forward pipeline would favor the design-lead path instead.",
          handoff: { kind: "route", href: "/opportunities/opp-6", label: "Open Meridian Labs" },
        },
      },
      {
        id: "copilot-planner-3",
        prompt: "What's the single next move?",
        response: {
          lead: "Prioritize Meridian Labs panel prep, the panel round Thursday, August 6 is the nearest live decision point on your strongest AI-forward loop.",
          handoff: { kind: "route", href: "/opportunities/opp-6#actions", label: "Open Actions tab" },
        },
      },
    ],
  },
  {
    surface: "Roadmap",
    suggestedPrompts: [
      "Why these 3 milestones?",
      "What should I do first?",
      "Which resource is your pick and why?",
    ],
    exchanges: [
      {
        id: "copilot-roadmap-1",
        prompt: "Why these 3 milestones?",
        response: {
          lead: "Each one builds on the last: ship the AI feature story, make it public, then use it to operate at staff altitude.",
          points: [
            { label: "Milestone 1", detail: "Closes the AI interaction and prompt design gap and ships a real artifact, not just the course." },
            { label: "Milestone 2", detail: "Turns that artifact into the public case study every AI-forward loop has been asking for." },
            { label: "Milestone 3", detail: "Backs a staff-level pitch with metrics fluency and a review you actually led." },
          ],
          confidence: "High",
        },
      },
      {
        id: "copilot-roadmap-2",
        prompt: "What should I do first?",
        response: {
          lead: "Start the AI Product Design Fundamentals course, it's the pinned next move and the foundation the rest of milestone 1 depends on.",
          handoff: { kind: "route", href: "/skills", label: "Open Skills & Learning" },
        },
      },
      {
        id: "copilot-roadmap-3",
        prompt: "Which resource is your pick and why?",
        response: {
          lead: "Prompt Systems for Product Teams, in milestone 1. It closes the single largest skill gap on this path before anything else in the milestone can move.",
          handoff: { kind: "route", href: "/roadmap", label: "See it in the milestone" },
        },
      },
    ],
  },
  {
    surface: "Rewind",
    suggestedPrompts: [
      "Why these three candidates?",
      "What happens once I save one?",
      "What if I skip a carry-forward?",
    ],
    exchanges: [
      {
        id: "copilot-rewind-1",
        prompt: "Why these three candidates?",
        response: {
          lead: "Each ties to one of this week's three theme clusters: Meridian Labs prep, the Halo Bank decision, and the AI review sync.",
          points: [
            { label: "Grounding", detail: "Every candidate carries the evidence chip it was drafted from, never a claim without a source." },
            { label: "Your call", detail: "Nothing joins Track Record until you save it, and every field is editable first." },
          ],
        },
      },
      {
        id: "copilot-rewind-2",
        prompt: "What happens once I save one?",
        response: {
          lead: "It becomes a Track Record entry with the achievement depth attached: impact signals, the evidence it cites, and how it ties to your target direction.",
          points: [{ label: "Where it shows up", detail: "Highlighted on the Track Record Highlights shelf, same object everywhere entries render." }],
          handoff: { kind: "route", href: "/track-record", label: "Open Track Record" },
        },
      },
      {
        id: "copilot-rewind-3",
        prompt: "What if I skip a carry-forward?",
        response: {
          lead: "Dismissing one just leaves it off next week's queue, nothing else changes.",
          points: [{ label: "Accepting instead", detail: "Pins it to your Home attention queue, and adds a next action when it names one." }],
        },
      },
    ],
  },
  {
    surface: "Strategy",
    suggestedPrompts: [
      "How is pipeline health judged?",
      "Why these moves this week?",
      "What happens if I skip a move?",
    ],
    exchanges: [
      {
        id: "copilot-strategy-1",
        prompt: "How is pipeline health judged?",
        response: {
          lead: "Three signals: strong-fit coverage, momentum, and effort balance.",
          points: [
            { label: "Strong-fit coverage", detail: "Share of your active opportunities Copilot currently rates Strong fit." },
            { label: "Momentum", detail: "Share of active opportunities with any activity in the last 7 days." },
            {
              label: "Effort balance",
              detail: "Whether your accepted next actions concentrate on your best-fit opportunities or your weakest ones.",
            },
          ],
        },
      },
      {
        id: "copilot-strategy-2",
        prompt: "Why these moves this week?",
        response: {
          lead: "Each one is grounded in a real gap: one opportunity worth focusing on, one worth a follow-up, one worth deprioritizing, and one honest gap in your pipeline.",
          points: [
            { label: "Nothing applies itself", detail: "Approve, adjust to a different candidate, or set any of them aside, your call." },
          ],
        },
      },
      {
        id: "copilot-strategy-3",
        prompt: "What happens if I skip a move?",
        response: {
          lead: "Nothing changes, it just sits as Not now with an Undo if you change your mind.",
          handoff: { kind: "route", href: "/opportunities", label: "Review your pipeline" },
        },
      },
    ],
  },
  // Recruiter mode (RDS-988): its own persona mode's surfaces, kept in a
  // separate module (lib/data/recruiter/copilot-scripts.ts) and spread in
  // here so this one registry, and the one CopilotPanel component that
  // reads it, keeps working unmodified across both persona modes.
  ...recruiterCopilotScripts,
];
