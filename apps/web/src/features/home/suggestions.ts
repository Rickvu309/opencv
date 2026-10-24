export type SuggestionId = string

export type Suggestion = {
  id: SuggestionId
  label: string
  prompt: string
}

/**
 * Four broad starters in product nouns. Generic, never a named demo persona
 * (PRODUCT.md open q. 4).
 */
export const BROAD_SUGGESTIONS: Suggestion[] = [
  {
    id: "cv",
    label: "Review my CV",
    prompt:
      "Review the CV in Paper. What's strongest, what's weak, and what should I cut?",
  },
  {
    id: "letter",
    label: "Draft a Letter",
    prompt:
      "Draft a short Letter for an associate PM intern role. Point to one Proof and keep it under half a page.",
  },
  {
    id: "apply",
    label: "Triage Apply",
    prompt:
      "Look at my Apply inbox and tell me which Opportunities to prioritize this week and which to drop.",
  },
  {
    id: "proof",
    label: "Start a Proof",
    prompt:
      "I finished a small study. Help me turn it into a Proof with one concrete outcome I can cite on my CV.",
  },
]

/** Narrower prompts, one level down behind "More ideas". */
export const MORE_SUGGESTIONS: Suggestion[] = [
  {
    id: "interview",
    label: "Prep interview",
    prompt:
      "Help me prepare for a product intern interview. What should I practice and which Proof stories should I lead with?",
  },
  {
    id: "week",
    label: "Plan this week",
    prompt:
      "What should I focus on this week for my search? I have Opportunities in Apply and a draft CV.",
  },
  {
    id: "pitch",
    label: "Polish Pitch",
    prompt:
      "What should I put on my Pitch before I share the link? I have two Proofs ready and a draft CV.",
  },
  {
    id: "gap",
    label: "Skill gaps",
    prompt:
      "Based on associate PM internships, what skill gaps show up most in the postings and what can I fix in two weeks?",
  },
  {
    id: "mock",
    label: "Mock questions",
    prompt:
      "Give me five realistic interview questions for an associate PM intern role and how to answer with Proof.",
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
    id: "nerves",
    label: "Interview nerves",
    prompt:
      "I am nervous before PM interviews. Give me a simple prep routine and one opening line I can memorize.",
  },
]
