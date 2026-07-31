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
