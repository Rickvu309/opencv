export type SuggestionId = string

export type Suggestion = {
  id: SuggestionId
  label: string
  prompt: string
}

/**
 * Chip prompts for Vietnamese early-career Users. Generic — never a
 * named demo persona (PRODUCT.md open q. 4).
 */
export const SUGGESTION_POOLS: Suggestion[][] = [
  [
    {
      id: "interview",
      label: "Prep interview",
      prompt:
        "Help me prepare for a product intern interview. What should I practice and which Proof stories should I lead with?",
    },
    {
      id: "letter",
      label: "Draft cover letter",
      prompt:
        "Draft a short cover letter for an associate PM intern role. Point to one Proof and keep it under half a page.",
    },
    {
      id: "cv",
      label: "Review my CV",
      prompt:
        "Review the CV in Paper. What's strongest, what's weak, and what should I cut?",
    },
    {
      id: "apply",
      label: "Plan this week",
      prompt:
        "What should I focus on this week for my job search? I have roles in Apply and a draft CV.",
    },
    {
      id: "proof",
      label: "Add proof",
      prompt:
        "I finished a small study. Help me turn it into a Proof with one concrete outcome I can cite on my CV.",
    },
    {
      id: "followup",
      label: "Follow up email",
      prompt:
        "Write a short follow-up email for a role I applied to last week. Keep it polite and specific.",
    },
    {
      id: "pitch",
      label: "Polish Pitch",
      prompt:
        "What should I put on my Pitch page before I share the link? I have two Proofs ready and a draft CV.",
    },
    {
      id: "inbox",
      label: "Triage Apply inbox",
      prompt:
        "Look at my Apply inbox and tell me which roles to prioritize this week and which to drop.",
    },
  ],
  [
    {
      id: "star",
      label: "Starred roles",
      prompt:
        "Which starred roles in Apply are worth a cover letter this weekend? Rank them and say why.",
    },
    {
      id: "gap",
      label: "Skill gaps",
      prompt:
        "Based on associate PM internships, what skill gaps show up most in JDs and what can I fix in two weeks?",
    },
    {
      id: "linkedin",
      label: "LinkedIn intro",
      prompt:
        "Write a short LinkedIn connection note to a PM at a local startup. No fluff, one Proof hook.",
    },
    {
      id: "outcome",
      label: "Sharpen outcome",
      prompt:
        "My Proof has research notes but a weak outcome line. Help me rewrite it with one measurable result.",
    },
    {
      id: "letter-fintech",
      label: "Fintech letter angle",
      prompt:
        "I am applying to a fintech product intern role. How do I frame a wallet onboarding audit without overselling?",
    },
    {
      id: "deadline",
      label: "Deadline check",
      prompt:
        "What application deadlines or interviews should I watch in the next 14 days?",
    },
    {
      id: "reject",
      label: "After rejection",
      prompt:
        "I got rejected from a UX research intern role. What should I learn from it and what is the next smallest step?",
    },
    {
      id: "project",
      label: "Side project story",
      prompt:
        "Turn a small product study into a one-paragraph story I can use in PM interviews.",
    },
  ],
  [
    {
      id: "mock",
      label: "Mock questions",
      prompt:
        "Give me five realistic interview questions for an associate PM intern role and how to answer with Proof.",
    },
    {
      id: "salary",
      label: "Intern pay norms",
      prompt:
        "What is a reasonable way to ask about intern pay or stipend in Vietnam without hurting my chances?",
    },
    {
      id: "referral",
      label: "Ask for referral",
      prompt:
        "Draft a message asking a senior student for a referral to a startup PM team. Keep it short and easy to say yes or no.",
    },
    {
      id: "portfolio",
      label: "Portfolio gap",
      prompt:
        "I do not have a polished portfolio yet. What can I link instead for early-career product manager roles?",
    },
    {
      id: "compare",
      label: "Compare roles",
      prompt:
        "Compare a fintech product intern role vs a local startup associate PM intern for my CV and goals.",
    },
    {
      id: "weekend",
      label: "Weekend plan",
      prompt:
        "Give me a two-hour weekend plan to move my job search forward without burning out.",
    },
    {
      id: "anxiety",
      label: "Interview nerves",
      prompt:
        "I am nervous before PM interviews. Give me a simple prep routine and one opening line I can memorize.",
    },
    {
      id: "proof-link",
      label: "Link proof on CV",
      prompt:
        "Where should I place a Proof on my CV and what one-line caption should sit under it?",
    },
  ],
]
