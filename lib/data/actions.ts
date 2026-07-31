import type { NextAction } from "@/lib/types";

// One primary next action per opportunity (all 9), each carrying a
// confidence chip, 2 to 3 alternatives with a "choose this when" line, and a
// "what would change this advice" line. Some primaries and alternatives also
// carry a follow-up (a fresh suggestion Copilot proposes once the action is
// marked done) or a handoff into Materials or the Copilot panel.
export const nextActions: NextAction[] = [
  // --- opp-1: Solace AI (Saved, Dream, Strong fit) -------------------------
  {
    id: "action-1",
    opportunityId: "opp-1",
    verb: "Send your AI explainability case study to the referral contact",
    rationale:
      "Solace AI is a Dream, Strong-fit match and the referral is still warm eight weeks after you saved it.",
    effort: "20 min",
    dueHint: "This week",
    state: "accepted",
    confidence: "High",
    alternatives: [
      {
        id: "alt-action-1-wait",
        verb: "Wait for the referral contact's next check-in",
        chooseWhen: "you already sent something recently and don't want to seem pushy.",
        rationale: "Give the referral room to raise it with the VP before you reach out again.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
      {
        id: "alt-action-1-research",
        verb: "Research Solace AI's published explainability work first",
        chooseWhen: "you want sharper technical vocabulary before the follow-up call.",
        rationale:
          "A closer read of their public research would sharpen how you frame the case study.",
        effort: "20 min",
        dueHint: "Before the follow-up call",
        confidence: "Medium",
        handoff: "copilot",
        copilotPrompt: "Give me a research summary on Solace AI",
      },
      {
        id: "alt-action-1-draft",
        verb: "Ask Copilot to draft the outreach message",
        chooseWhen: "you want a stronger first draft before sending anything.",
        rationale: "A drafted message gives you a stronger starting point than writing cold.",
        effort: "10 min",
        dueHint: "This week",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If the referral contact confirms the VP wants to fill this before end of Q3, sending the case study now moves ahead of waiting for their next check-in.",
    followUp: {
      verb: "Prep talking points for the follow-up call using the case study's key points",
      rationale:
        "Once the case study is sent, a short prep pass keeps the explainability story sharp for the actual conversation.",
      effort: "15 min",
      dueHint: "Before the follow-up call",
      confidence: "Medium",
    },
  },

  // --- opp-2: Vanta Growth Labs (Saved, credibility flag, Unknown fit) -----
  {
    id: "action-7",
    opportunityId: "opp-2",
    verb: "Confirm a real hiring contact before going further with Vanta Growth Labs",
    rationale:
      "Fit can't be judged responsibly while the credibility check is failing, a named contact is the fastest way to clear it.",
    effort: "10 min",
    dueHint: "No rush",
    state: "suggested",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-7-wait",
        verb: "Wait for the credibility flag to clear on its own",
        chooseWhen: "you'd rather not spend time chasing a thin listing.",
        rationale:
          "Nothing here is time-sensitive, waiting costs little against your three verified Strong-fit opportunities.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
      {
        id: "alt-action-7-archive",
        verb: "Archive now given the failed credibility check",
        chooseWhen: "you'd rather not hold a slot for a posting that may not be real.",
        rationale:
          "All three checks that normally confirm a real opening came back empty here.",
        effort: "2 min",
        dueHint: "This week",
        confidence: "Medium",
      },
      {
        id: "alt-action-7-ask",
        verb: "Ask Copilot what it would take to clear the flag",
        chooseWhen: "you want a clearer bar before deciding whether to chase it further.",
        rationale: "A scripted read on exactly what's missing narrows whether this is worth more time.",
        effort: "5 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If a verifiable hiring manager or current employee turns up on LinkedIn, confirming the contact moves ahead of archiving.",
  },

  // --- opp-3: Northwind Robotics (Saved, Medium fit, 11 weeks stale) -------
  {
    id: "action-6",
    opportunityId: "opp-3",
    verb: "Decide: pursue or archive Northwind Robotics",
    rationale:
      "Medium fit and eleven weeks with no update means this is worth a clear decision rather than sitting in Saved indefinitely.",
    effort: "10 min",
    dueHint: "This week",
    state: "suggested",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-6-research",
        verb: "Research the team before deciding",
        chooseWhen: "you want to confirm whether the posting is still an active search before committing time.",
        rationale:
          "A closer look at Northwind's recent product launches would confirm whether the eleven-week silence means a stalled search.",
        effort: "15 min",
        dueHint: "No rush",
        confidence: "Medium",
        handoff: "copilot",
        copilotPrompt: "Give me a research summary on Northwind Robotics",
        followUp: {
          verb: "Reach out to Northwind's hiring manager with what you learned",
          rationale:
            "Once you've confirmed the search is still active, a direct message referencing what you found is a stronger opener than a generic follow-up.",
          effort: "15 min",
          dueHint: "This week",
          confidence: "Medium",
        },
      },
      {
        id: "alt-action-6-tailor",
        verb: "Tailor your CV for Northwind before applying",
        chooseWhen: "you decide to pursue this and want strong materials ready first.",
        rationale:
          "The mentoring and operations-dashboard scope is real leadership evidence worth surfacing clearly in your materials.",
        effort: "30 min",
        dueHint: "Before applying",
        confidence: "Low",
        handoff: "materials",
      },
      {
        id: "alt-action-6-archive",
        verb: "Archive now without further research",
        chooseWhen: "the AI-focused roles already have enough of your attention.",
        rationale:
          "Hardware-adjacent, technician-facing scope is the furthest opportunity from your target direction right now.",
        effort: "2 min",
        dueHint: "This week",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If Northwind's team confirms the search is still active and open to remote candidates, researching first moves ahead of archiving.",
  },

  // --- opp-4: Arclight AI (Applied, Strong fit) ----------------------------
  {
    id: "action-2",
    opportunityId: "opp-4",
    verb: "Follow up with the Arclight AI recruiter on application status",
    rationale: "No update in 16 days on a Strong-fit, high-priority application is worth a light nudge.",
    effort: "10 min",
    dueHint: "Next 2 days",
    state: "suggested",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-2-wait",
        verb: "Wait for the review committee's next biweekly meeting",
        chooseWhen: "you followed up recently and want to avoid seeming impatient.",
        rationale:
          "The committee already meets on a set cadence, a second nudge this soon may not change the timeline.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
      {
        id: "alt-action-2-contact",
        verb: "Reach out to a contact at Arclight for an unofficial read",
        chooseWhen: "you have any warmer contact than the recruiter thread.",
        rationale:
          "A direct contact can sometimes surface committee movement faster than a recruiter update.",
        effort: "15 min",
        dueHint: "This week",
        confidence: "Low",
      },
      {
        id: "alt-action-2-draft",
        verb: "Ask Copilot to draft the follow-up message",
        chooseWhen: "you want a stronger draft before sending.",
        rationale: "A scripted starting point keeps the tone confident without sounding anxious.",
        effort: "10 min",
        dueHint: "Next 2 days",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If the recruiter confirms the committee already reviewed your application this week, waiting moves ahead of following up again.",
  },

  // --- opp-5: Tidal Finance (Applied, Weak fit) ----------------------------
  {
    id: "action-8",
    opportunityId: "opp-5",
    verb: "Decide whether to formally withdraw from Tidal Finance",
    rationale:
      "On-site only and no AI-facing scope both run counter to your preferences, worth a clean decision instead of a quiet drift.",
    effort: "10 min",
    dueHint: "No rush",
    state: "suggested",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-8-drift",
        verb: "Let the application go quiet without formally withdrawing",
        chooseWhen: "you'd rather not spend the effort on a role you're not pursuing.",
        rationale: "Nothing about this application is time-sensitive enough to require a formal close.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Low",
      },
      {
        id: "alt-action-8-ask",
        verb: "Ask about remote flexibility before withdrawing",
        chooseWhen: "the on-site requirement is the only thing holding you back.",
        rationale:
          "If the location requirement has any flexibility, the domain familiarity here still counts for something.",
        effort: "10 min",
        dueHint: "No rush",
        confidence: "Low",
      },
    ],
    whatWouldChangeThis: "If Tidal confirms a hybrid option, asking about flexibility moves ahead of withdrawing.",
  },

  // --- opp-6: Meridian Labs (Interview, Strong fit) ------------------------
  {
    id: "action-3",
    opportunityId: "opp-6",
    verb: "Prep answers for the Meridian Labs design leadership panel",
    rationale:
      "Panel round is scheduled and typically probes how you'd lead design decisions, not just make them.",
    effort: "45 min",
    dueHint: "Before Thursday",
    state: "accepted",
    confidence: "High",
    alternatives: [
      {
        id: "alt-action-3-wait",
        verb: "Wait until closer to Thursday to prep",
        chooseWhen: "you'd rather keep the material fresh instead of over-rehearsing early.",
        rationale: "Prepping too far ahead can make answers sound memorized instead of considered.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Low",
      },
      {
        id: "alt-action-3-cv",
        verb: "Review your tailored Meridian Labs CV once more first",
        chooseWhen: "you want the case study details fresh before drafting talking points.",
        rationale:
          "The tailored CV already highlights the confidence-indicator work the panel is likely to probe.",
        effort: "15 min",
        dueHint: "Before Thursday",
        confidence: "Medium",
        handoff: "materials",
      },
      {
        id: "alt-action-3-ask",
        verb: "Ask Copilot what the panel is most likely to probe",
        chooseWhen: "you want a sharper focus before spending the full prep session.",
        rationale: "A quick scripted read on the fit concern narrows what's worth rehearsing.",
        effort: "5 min",
        dueHint: "Before Thursday",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If Meridian moves the panel date up, reviewing the tailored CV first moves ahead of the full prep session.",
    followUp: {
      verb: "Send a thank-you note after the panel round",
      rationale:
        "A same-week note after a panel keeps momentum while the committee deliberates, the same pattern that worked well at Brightpath Bank.",
      effort: "10 min",
      dueHint: "Same day",
      confidence: "High",
    },
  },

  // --- opp-7: Brightpath Bank (Interview, Medium fit) ----------------------
  // Historical: already done, kept for the Activity and Plan history.
  {
    id: "action-4",
    opportunityId: "opp-7",
    verb: "Send a thank-you note after the Brightpath Bank final loop",
    rationale: "A same-week note after a final loop keeps momentum while the panel deliberates.",
    effort: "10 min",
    dueHint: "Same day",
    state: "done",
    confidence: "High",
  },
  // Current primary: the open question left after the final loop.
  {
    id: "action-9",
    opportunityId: "opp-7",
    verb: "Ask the Brightpath Bank committee for a decision timeline",
    rationale: "The final loop wrapped without a stated timeline, the one open question left before an offer decision.",
    effort: "10 min",
    dueHint: "This week",
    state: "suggested",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-9-wait",
        verb: "Wait quietly for the committee's decision",
        chooseWhen: "you'd rather not seem impatient after a final loop that felt strong.",
        rationale: "Final loops can take a few weeks to clear a committee even when feedback was positive.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
      {
        id: "alt-action-9-tradeoff",
        verb: "Weigh the management-versus-AI tradeoff before responding to any offer",
        chooseWhen: "you want your decision ready before the committee comes back.",
        rationale:
          "This is a genuine two-direction tradeoff between your leadership goal and your AI-product goal, worth deciding ahead of time.",
        effort: "15 min",
        dueHint: "No rush",
        confidence: "Medium",
      },
      {
        id: "alt-action-9-draft",
        verb: "Ask Copilot to draft the check-in message",
        chooseWhen: "you want a confident draft rather than writing cold.",
        rationale:
          "A scripted starting point keeps the tone appreciative without sounding anxious about the wait.",
        effort: "5 min",
        dueHint: "This week",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If Meridian Labs' panel result lands first, weighing the tradeoff moves ahead of checking in with Brightpath.",
  },

  // --- opp-8: Orbit Logistics (Offer, Strong fit) --------------------------
  {
    id: "action-5",
    opportunityId: "opp-8",
    verb: "Review the Orbit Logistics offer terms against your target compensation range",
    rationale:
      "Offer deadline is approaching and the base sits at the low end of what you told Copilot you're targeting.",
    effort: "30 min",
    dueHint: "Before the offer deadline",
    state: "suggested",
    confidence: "High",
    alternatives: [
      {
        id: "alt-action-5-negotiate",
        verb: "Negotiate the base salary before deciding",
        chooseWhen: "the gap to your target range is worth raising directly.",
        rationale:
          "The concern in your fit read specifically flags base pay at the low end, a reasonable opening to negotiate.",
        effort: "20 min",
        dueHint: "Before the offer deadline",
        confidence: "Medium",
      },
      {
        id: "alt-action-5-wait",
        verb: "Wait for Meridian Labs' panel result before deciding",
        chooseWhen: "you'd rather compare two live outcomes than decide on Orbit alone.",
        rationale: "Meridian is your closer AI-direction match, worth knowing where that stands before committing.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Low",
      },
      {
        id: "alt-action-5-ask",
        verb: "Ask Copilot for the honest tradeoff on this offer",
        chooseWhen: "you want the gain-and-give spelled out before you decide.",
        rationale:
          "A quick scripted read lines up the offer against your target direction and preferences in one place.",
        effort: "5 min",
        dueHint: "Before the offer deadline",
        confidence: "Medium",
      },
    ],
    whatWouldChangeThis:
      "If Orbit moves the base salary into your target range, accepting moves ahead of waiting on Meridian's panel result.",
  },

  // --- opp-9: Vela Studio (Closed) ------------------------------------------
  {
    id: "action-10",
    opportunityId: "opp-9",
    verb: "Log a screening note about timezone requirements for future roles",
    rationale:
      "Closed on a schedule mismatch, not fit or credibility, worth a short note so future screening catches this earlier.",
    effort: "5 min",
    dueHint: "No rush",
    state: "done",
    confidence: "Medium",
    alternatives: [
      {
        id: "alt-action-10-none",
        verb: "Leave it closed with no further action",
        chooseWhen: "the timezone mismatch was decisive enough that no note is needed.",
        rationale: "Withdrawing before the loop continued already settled this cleanly.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Low",
      },
      {
        id: "alt-action-10-revisit",
        verb: "Revisit only if Vela posts an APAC-hours role",
        chooseWhen: "the agency model itself still appeals to you.",
        rationale:
          "The agency pace and variety matched your Bambu Studio experience, only the schedule was the problem.",
        effort: "0 min",
        dueHint: "No rush",
        confidence: "Low",
      },
    ],
    whatWouldChangeThis:
      "If Vela posts a role with Ho Chi Minh City-friendly hours, revisiting moves ahead of leaving it closed.",
  },
];
