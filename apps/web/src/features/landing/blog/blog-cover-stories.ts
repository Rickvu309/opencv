type CoverStory = { description: string } & (
  | {
      kind: "result"
      duty: string
      before: string
      after: string
      measure: string
    }
  | { kind: "shortlist"; generic: string; specific: string; caption: string }
  | { kind: "focus"; edits: readonly [string, string, string] }
  | {
      kind: "timeline"
      start: string
      interval: string
      end: string
      note: readonly [string, string]
    }
  | { kind: "conversation"; question: string; evidence: string }
  | { kind: "publication"; status: string; artifact: string }
)

export const BLOG_COVER_STORIES = {
  "show-work": {
    kind: "result",
    description:
      "A duty becomes evidence: event post views increase from 200 to 1,400.",
    duty: "Managed Instagram",
    before: "200",
    after: "1,400",
    measure: "Event post views",
  },
  "fewer-applications": {
    kind: "shortlist",
    description:
      "Replace 50 generic applications with five CVs tailored to specific jobs.",
    generic: "50 generic",
    specific: "5 specific",
    caption: "One job. One tailored CV.",
  },
  "top-third": {
    kind: "focus",
    description:
      "Tailor the summary, first role and three bullets at the top of a CV; keep the rest.",
    edits: ["Summary", "First role", "Three bullets"],
  },
  "follow-up": {
    kind: "timeline",
    description:
      "Three days after applying, send a note naming what you would fix and linking to proof.",
    start: "Applied",
    interval: "3 days later",
    end: "Follow-up",
    note: ["What I’d fix first", "Link to proof"],
  },
  discovery: {
    kind: "conversation",
    description: "Ask what needs fixing before showing one relevant case.",
    question: "What needs fixing?",
    evidence: "One relevant case",
  },
  "in-public": {
    kind: "publication",
    description:
      "Move from an Open to work status to a published before-and-after case anyone can open.",
    status: "Open to work",
    artifact: "Publish the work",
  },
} as const satisfies Record<string, CoverStory>

export type BlogCoverKey = "b2b-sales" | keyof typeof BLOG_COVER_STORIES
export type BlogCoverStory =
  (typeof BLOG_COVER_STORIES)[keyof typeof BLOG_COVER_STORIES]
