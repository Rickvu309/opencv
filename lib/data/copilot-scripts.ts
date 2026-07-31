import type { CopilotSurfaceScript } from "@/lib/types";

// Per-surface suggested prompts and scripted exchanges for the Copilot panel.
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
        response:
          "Meridian Labs' panel round is your nearest deadline and strongest AI-direction match, I'd prep for that first. Orbit Logistics' offer window is also closing, worth a compensation decision before it lapses.",
      },
      {
        id: "copilot-home-2",
        prompt: "Which opportunity needs attention right now?",
        response:
          "Solace AI: it's a Dream, strong-fit match with a warm referral, and it's been 4 weeks since you saved it with no message sent yet. The accepted next action to send your case study is still open.",
      },
      {
        id: "copilot-home-3",
        prompt: "Summarize what changed since last week.",
        response:
          "Meridian Labs advanced to the panel round, Brightpath Bank's final loop wrapped, and Orbit Logistics extended an offer. I also drafted 2 Track Record candidates from this week's activity, worth a look before the details fade.",
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
        response:
          "Solace AI, Arclight AI, Meridian Labs, and Orbit Logistics are all rated Strong. Solace AI and Meridian Labs are the closest matches to your target direction in AI product design specifically.",
      },
      {
        id: "copilot-opportunities-2",
        prompt: "What's stale and worth archiving?",
        response:
          "Northwind Robotics hasn't moved in 11 weeks. I'd either move it to Applied this week or archive it, it's the one saved role without a clear next step.",
      },
      {
        id: "copilot-opportunities-3",
        prompt: "Help me add a new opportunity from a link.",
        response:
          "Paste the job link or description into the Add dialog's first tab and I'll parse it into role, company, location, and salary fields for you to review before it's saved.",
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
        response:
          "This role's core scope overlaps closely with work you've already shipped, that's the main driver of a Strong rating. Check the AI Analysis tab for the specific strengths, concerns, and unknowns behind the judgment.",
      },
      {
        id: "copilot-opportunity-detail-2",
        prompt: "What should my next step be here?",
        response:
          "The Actions tab has a suggested next step with a one-line rationale. You can accept it as is, edit it, or dismiss it if it doesn't fit, nothing happens automatically either way.",
      },
      {
        id: "copilot-opportunity-detail-3",
        prompt: "Draft a message to follow up.",
        response:
          "Something like: 'Hi, following up on my application, still very interested and happy to share more detail on my explainability work if useful.' Edit the specifics before sending, I don't send anything myself.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Solace AI",
    suggestedPrompts: [
      "What does 'trustworthy interface patterns' actually mean here?",
      "How much weight should I put on the referral?",
      "What should I lead with in my case study for this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-1-1",
        prompt: "What does 'trustworthy interface patterns' actually mean here?",
        response:
          "It means you'd be designing the visual language for model confidence and uncertainty from scratch, Solace doesn't have an existing pattern for this yet. Expect to invent it, not adapt one.",
      },
      {
        id: "copilot-opp-1-2",
        prompt: "How much weight should I put on the referral?",
        response:
          "A lot. Your contact has worked directly with Solace's design team, that's a credible internal voice, not just a secondhand tip. It's part of why credibility confidence sits at High.",
      },
      {
        id: "copilot-opp-1-3",
        prompt: "What should I lead with in my case study for this one?",
        response:
          "Lead with the explainability panel from Fintra first. It's the single piece of evidence that maps most directly onto owning Solace's explainability layer.",
      },
      {
        id: "copilot-opp-1-research",
        prompt: "Give me a research summary on Solace AI",
        response:
          "Solace AI's engineering blog and their VP of Product's public talks focus heavily on model-explainability for clinical decision support, particularly contributing-factor visualizations for their diagnosis-support product. Their most recent post, from June 2026, covers how they render model confidence for non-technical clinicians, a close match for the explainability layer this role owns. Worth referencing that post directly in your case study.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Vanta Growth Labs",
    suggestedPrompts: [
      "Is this posting worth pursuing at all?",
      "What would it take to clear the credibility flag?",
      "Why is fit marked Unknown instead of Weak?",
    ],
    exchanges: [
      {
        id: "copilot-opp-2-1",
        prompt: "Is this posting worth pursuing at all?",
        response:
          "Not yet. Three separate checks, company presence, named team, and product description, all came back empty. I'd hold this in Saved until at least one clears.",
      },
      {
        id: "copilot-opp-2-2",
        prompt: "What would it take to clear the credibility flag?",
        response:
          "A real hiring manager or current employee you can verify on LinkedIn, or a company site with more than a single unregistered-looking domain page.",
      },
      {
        id: "copilot-opp-2-3",
        prompt: "Why is fit marked Unknown instead of Weak?",
        response:
          "Unknown means there isn't enough verified information to judge fit responsibly yet. Weak would imply I've seen the role and it doesn't match, which isn't true here.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Northwind Robotics",
    suggestedPrompts: [
      "Should I keep this one active or archive it?",
      "Why does mentoring count toward fit here?",
      "What's the biggest gap against my target direction?",
    ],
    exchanges: [
      {
        id: "copilot-opp-3-1",
        prompt: "Should I keep this one active or archive it?",
        response:
          "Worth one more check before deciding. Eleven weeks with no update is long enough that either it's stalled or deprioritized on their end, I'd ask directly rather than keep waiting.",
      },
      {
        id: "copilot-opp-3-2",
        prompt: "Why does mentoring count toward fit here?",
        response:
          "Because the lead scope names mentoring two designers explicitly, that's real progress toward your goal to grow into people leadership, even outside your primary AI direction.",
      },
      {
        id: "copilot-opp-3-3",
        prompt: "What's the biggest gap against my target direction?",
        response:
          "No AI or model-facing work anywhere in the listed scope. It's the clearest gap against your target direction of AI product design and leadership.",
      },
      {
        id: "copilot-opp-3-research",
        prompt: "Give me a research summary on Northwind Robotics",
        response:
          "Northwind's last two product announcements, from April and June 2026, both focus on fleet-routing efficiency for their existing operations dashboard, not a new hardware line. That's a sign the eleven-week-old posting is likely still an active operations-design need rather than a stalled or deprioritized search. No new hiring-manager name has surfaced publicly yet, so a direct check-in is still worth it.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Arclight AI",
    suggestedPrompts: [
      "How is this different from Meridian Labs?",
      "What's the biggest risk if I get an offer here?",
      "Why is the team size listed as a concern?",
    ],
    exchanges: [
      {
        id: "copilot-opp-4-1",
        prompt: "How is this different from Meridian Labs?",
        response:
          "Arclight is about the suggestion-and-approval interaction itself, workflow automation for operations teams. Meridian is about reviewer-facing confidence and uncertainty for evaluating models. Both are trust-boundary work, different audiences.",
      },
      {
        id: "copilot-opp-4-2",
        prompt: "What's the biggest risk if I get an offer here?",
        response:
          "The unclear path to design leadership as the team grows. Worth asking directly in a follow-up conversation before you'd need to decide on an offer.",
      },
      {
        id: "copilot-opp-4-3",
        prompt: "Why is the team size listed as a concern?",
        response:
          "A three-person pod is efficient day to day but has less slack for structured mentorship, which matters for your goal to grow into people leadership.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Tidal Finance",
    suggestedPrompts: [
      "Why is this rated Weak instead of Medium?",
      "Is the on-site requirement really a dealbreaker?",
      "What would change my mind about this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-5-1",
        prompt: "Why is this rated Weak instead of Medium?",
        response:
          "Three things stack against it at once: broad-shallow scope, on-site only, and no AI-facing work. Any one alone might land at Medium, together they pull it to Weak.",
      },
      {
        id: "copilot-opp-5-2",
        prompt: "Is the on-site requirement really a dealbreaker?",
        response:
          "It's your call, but it runs directly against your Remote work-style preference, and there's no hybrid option mentioned anywhere in the listing.",
      },
      {
        id: "copilot-opp-5-3",
        prompt: "What would change my mind about this one?",
        response:
          "A narrower scope on one surface, or a path to remote work, either would meaningfully change the read here.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Meridian Labs",
    suggestedPrompts: [
      "What should I focus on for the panel round?",
      "How confident are we in the Strong rating?",
      "What's still unknown about this one?",
    ],
    exchanges: [
      {
        id: "copilot-opp-6-1",
        prompt: "What should I focus on for the panel round?",
        response:
          "Leadership judgment, that's what the panel is most likely to probe next, per the fit concern. Your craft evidence is already strong, spend your prep time on decisions and tradeoffs, not portfolio polish.",
      },
      {
        id: "copilot-opp-6-2",
        prompt: "How confident are we in the Strong rating?",
        response:
          "High. A referral with direct hiring-manager contact, two rounds matching the original posting, and console scope nearly identical to your Fintra explainability panel, all three line up.",
      },
      {
        id: "copilot-opp-6-3",
        prompt: "What's still unknown about this one?",
        response:
          "Final compensation band hasn't been discussed yet, that's the one open item left before an offer decision.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Brightpath Bank",
    suggestedPrompts: [
      "Is the management scope worth the AI tradeoff?",
      "What should I ask about the decision timeline?",
      "How does this compare to my other Interview-stage role?",
    ],
    exchanges: [
      {
        id: "copilot-opp-7-1",
        prompt: "Is the management scope worth the AI tradeoff?",
        response:
          "That's the real tradeoff to weigh: real progress on your people-leadership goal against time away from your AI-product goal. Neither is wrong, it depends which you want to prioritize next.",
      },
      {
        id: "copilot-opp-7-2",
        prompt: "What should I ask about the decision timeline?",
        response:
          "Ask directly when the committee expects to decide, the final loop wrapped without a stated timeline, and it's the one unknown left.",
      },
      {
        id: "copilot-opp-7-3",
        prompt: "How does this compare to my other Interview-stage role?",
        response:
          "Meridian Labs is your stronger AI-direction match. Brightpath is your stronger leadership match. They're pulling in different directions on purpose.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Orbit Logistics",
    suggestedPrompts: [
      "Should I negotiate on the base salary?",
      "How does this offer compare to my target direction?",
      "What's the honest tradeoff here?",
    ],
    exchanges: [
      {
        id: "copilot-opp-8-1",
        prompt: "Should I negotiate on the base salary?",
        response:
          "Worth trying. The concern notes it sits at the low end of your target range, that's exactly the kind of gap worth raising before you accept.",
      },
      {
        id: "copilot-opp-8-2",
        prompt: "How does this offer compare to my target direction?",
        response:
          "It's a lateral move on the AI dimension specifically, strong on craft and your remote preference, but not advancing your goal to land a senior or staff AI product design role.",
      },
      {
        id: "copilot-opp-8-3",
        prompt: "What's the honest tradeoff here?",
        response:
          "You'd gain a confirmed offer with scope you're already good at. You'd give up ground on your AI-direction goal and settle for below-target pay unless you negotiate.",
      },
    ],
  },
  {
    surface: "Opportunity Detail: Vela Studio",
    suggestedPrompts: [
      "Why did this end up Closed?",
      "Was withdrawing the right call?",
      "What would make a similar agency role work next time?",
    ],
    exchanges: [
      {
        id: "copilot-opp-9-1",
        prompt: "Why did this end up Closed?",
        response:
          "Timezone overlap with the US team proved unworkable against your Ho Chi Minh City schedule, that's the specific reason logged, not a credibility or scope issue.",
      },
      {
        id: "copilot-opp-9-2",
        prompt: "Was withdrawing the right call?",
        response:
          "Yes. Continuing past the first screen would have meant testing an incompatible schedule further, with little upside toward your target direction either way.",
      },
      {
        id: "copilot-opp-9-3",
        prompt: "What would make a similar agency role work next time?",
        response:
          "APAC or Ho Chi Minh City-hours client work specifically, the agency model itself wasn't the problem, the timezone was.",
      },
    ],
  },
  {
    surface: "Profile",
    suggestedPrompts: [
      "What do you use from my profile when judging fit?",
      "What should I update before applying more broadly?",
    ],
    exchanges: [
      {
        id: "copilot-profile-1",
        prompt: "What do you use from my profile when judging fit?",
        response:
          "Mainly your target direction, strengths, and the specific experience entries, especially the Fintra explainability work, since it's the strongest evidence for the AI-direction roles you're pursuing.",
      },
      {
        id: "copilot-profile-2",
        prompt: "What should I update before applying more broadly?",
        response:
          "Your summary still leads with general fintech breadth. Leading with the explainability panel work first would better match the AI-forward roles you're prioritizing right now.",
      },
    ],
  },
  {
    surface: "CV Versions",
    suggestedPrompts: [
      "Which CV should I use for an AI-focused role?",
      "Tailor my base CV for a new opportunity.",
    ],
    exchanges: [
      {
        id: "copilot-cvs-1",
        prompt: "Which CV should I use for an AI-focused role?",
        response:
          "Start from Base CV and tailor it, the way the Meridian Labs version leads with your explainability panel work. Product-lead CV is better suited when management scope is the primary ask.",
      },
      {
        id: "copilot-cvs-2",
        prompt: "Tailor my base CV for a new opportunity.",
        response:
          "Link a base CV to the opportunity from its Materials tab, then choose Tailor for this role. I'll suggest section-by-section changes for you to accept, edit, or dismiss.",
      },
    ],
  },
  {
    surface: "Track Record",
    suggestedPrompts: [
      "What should I confirm from this week?",
      "Which entries best support my AI direction?",
    ],
    exchanges: [
      {
        id: "copilot-track-record-1",
        prompt: "What should I confirm from this week?",
        response:
          "Two drafted candidates: the credibility-check heuristic from Tuesday's AI review sync, and the trust-cue research sprint. Both are already referenced elsewhere this week, worth confirming while details are fresh.",
      },
      {
        id: "copilot-track-record-2",
        prompt: "Which entries best support my AI direction?",
        response:
          "The explainability panel launch and the AI assistant discovery sprint are your strongest evidence. Both are already linked to your AI and ML literacy skill.",
      },
    ],
  },
  {
    surface: "Goals",
    suggestedPrompts: [
      "Am I on track for my AI product design goal?",
      "What's the gap analysis showing me?",
    ],
    exchanges: [
      {
        id: "copilot-goals-1",
        prompt: "Am I on track for my AI product design goal?",
        response:
          "Yes, on track. Three strong-fit opportunities are active against it, and Meridian Labs is a near-exact scope match. The case study goal supporting it is behind schedule though.",
      },
      {
        id: "copilot-goals-2",
        prompt: "What's the gap analysis showing me?",
        response:
          "Your target direction goal shows the same 4 skill gaps as the Skills page: AI and ML literacy, AI interaction design, people management, and public speaking. All 4 have a learning item suggested already.",
      },
    ],
  },
  {
    surface: "Skills & Learning",
    suggestedPrompts: [
      "Which gap should I close first?",
      "What learning items are already planned?",
    ],
    exchanges: [
      {
        id: "copilot-skills-1",
        prompt: "Which gap should I close first?",
        response:
          "AI and ML literacy, it's the gap most directly blocking your target direction and the one with the most upcoming panel exposure at Meridian Labs.",
      },
      {
        id: "copilot-skills-2",
        prompt: "What learning items are already planned?",
        response:
          "Two are planned: shipping a small AI-assisted side project, and the quarterly public case study habit. The rest are still suggested, waiting on you to accept them.",
      },
    ],
  },
];
