export const HELP_TITLE = "opencv. Help"

export const HELP_HEADLINE = "Help"

export const HELP_SUBHEAD = "Answers to common questions about opencv."

export const HELP_DESCRIPTION =
  "Answers to common questions about opencv. Sign in with an email code, then use Paper, Apply, Coach and Inbox."

export const HELP_SEARCH_LABEL = "Search help"

export const HELP_EMPTY = "No answers match"

export const HELP_STUCK_TITLE = "Still stuck?"

export const HELP_STUCK_BODY = "Sign in and ask Coach."

export const HELP_STUCK_LINK = "Sign in"

export type HelpTopicId =
  | "getting-started"
  | "paper"
  | "apply"
  | "coach"
  | "inbox"
  | "plans"
  | "account"

export type HelpQuestion = {
  id: string
  question: string
  answer: string
}

export type HelpTopic = {
  id: HelpTopicId
  title: string
  blurb: string
  questions: readonly HelpQuestion[]
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Sign in with email and a code.",
    questions: [
      {
        id: "getting-started-sign-in",
        question: "How do I sign in?",
        answer:
          "Enter your email. We send a 6-digit code. There is no password.",
      },
      {
        id: "getting-started-account",
        question: "Do I need to sign up first?",
        answer: "No. The first code that works creates your account.",
      },
      {
        id: "getting-started-start",
        question: "Where do I land after sign-in?",
        answer:
          "On the start page you picked in Settings. Apply is the default.",
      },
      {
        id: "getting-started-google",
        question: "Can I sign in with Google?",
        answer:
          "Yes, when Google sign-in is turned on. Otherwise use your email and a code.",
      },
      {
        id: "getting-started-session",
        question: "What if my session ends?",
        answer:
          "Continue as the same email, or ask for a new code. Your work stays saved.",
      },
    ],
  },
  {
    id: "paper",
    title: "Paper",
    blurb: "CVs, letters and imported files.",
    questions: [
      {
        id: "paper-holds",
        question: "What does Paper hold?",
        answer: "Your CVs, cover letters, Proofs and files you import.",
      },
      {
        id: "paper-cv",
        question: "How do I edit a CV?",
        answer:
          "In a block document, with templates, an import check and a one-page fit prompt.",
      },
      {
        id: "paper-letter",
        question: "Can I draft a cover letter from a job?",
        answer: "Yes. Draft it from a Job. Add a suggestion, or skip it.",
      },
      {
        id: "paper-proof",
        question: "Is Proof ready?",
        answer: "Not yet. Proof is coming soon.",
      },
    ],
  },
  {
    id: "apply",
    title: "Apply",
    blurb: "A board from Saved to Offer.",
    questions: [
      {
        id: "apply-track",
        question: "What does Apply track?",
        answer: "Your jobs, on a board, a list and a calendar.",
      },
      {
        id: "apply-stages",
        question: "What stages can a job be in?",
        answer:
          "Saved, Applied, Interview, Offer and Closed. Closed is hidden.",
      },
      {
        id: "apply-add",
        question: "How do I add a job?",
        answer:
          "Add it by hand, or paste a link to fill the form. The link does not scan the page.",
      },
      {
        id: "apply-detail",
        question: "What is on a job?",
        answer:
          "The posting, a prep checklist, notes, an activity feed and properties.",
      },
      {
        id: "apply-search",
        question: "Does opencv search for jobs?",
        answer: "No. You bring jobs in. The Jobs page is coming soon.",
      },
    ],
  },
  {
    id: "coach",
    title: "Coach",
    blurb: "Free, Light and Max.",
    questions: [
      {
        id: "coach-where",
        question: "Where is Coach?",
        answer: "On its own page, and in a panel you can open over any page.",
      },
      {
        id: "coach-modes",
        question: "What are the Coach modes?",
        answer:
          "Free, Light and Max. The composer labels Max as Power. Light and Max need Pro.",
      },
      {
        id: "coach-cap",
        question: "What happens at the Free cap?",
        answer: "A banner shows the reset time. The composer waits until then.",
      },
      {
        id: "coach-usage",
        question: "How is usage shown?",
        answer:
          "As a percentage for this session and for the week. Not as a credit number.",
      },
      {
        id: "coach-model",
        question: "Which model does Coach use?",
        answer:
          "On the Free plan, Coach uses a free model. On Pro, Coach uses Claude.",
      },
      {
        id: "coach-limits",
        question: "What are the daily caps?",
        answer:
          "On the Free plan, the default is 20 turns a day. On Pro, Free mode has no daily cap. Light defaults to 10 and Max defaults to 5.",
      },
    ],
  },
  {
    id: "inbox",
    title: "Inbox",
    blurb: "Recruiter mail, sent only by you.",
    questions: [
      {
        id: "inbox-what",
        question: "What is Inbox?",
        answer: "Recruiter mail matched to your jobs.",
      },
      {
        id: "inbox-send",
        question: "Can opencv send mail on its own?",
        answer: "No. Nothing in Inbox is sent until you click send.",
      },
      {
        id: "inbox-gmail",
        question: "How does mail get into Inbox?",
        answer:
          "Gmail connects when Google sign-in is turned on. You can skip that for now.",
      },
      {
        id: "inbox-apps",
        question: "Are Calendar and Outlook connected?",
        answer: "They are shown in Settings. They are not connected yet.",
      },
    ],
  },
  {
    id: "plans",
    title: "Plans and billing",
    blurb: "Free is $0. Pro is $9 a month.",
    questions: [
      {
        id: "plans-cost",
        question: "What does opencv cost?",
        answer: "Free is $0 a month. Pro is $9 a month.",
      },
      {
        id: "plans-free",
        question: "What is on the Free plan?",
        answer:
          "The Free Coach mode, your CVs and letters, and the Apply board, list and calendar.",
      },
      {
        id: "plans-pro",
        question: "What does Pro add?",
        answer: "Light and Max, and Claude instead of the free model.",
      },
      {
        id: "plans-upgrade",
        question: "How do I get Pro?",
        answer: "Upgrade is not open yet. Pro is granted by hand.",
      },
      {
        id: "plans-card",
        question: "Is there a card on file?",
        answer: "No. Billing shows your plan, with no card and no invoices.",
      },
      {
        id: "plans-next",
        question: "What is coming next?",
        answer: "Proof and Pitch. Both are coming next.",
      },
    ],
  },
  {
    id: "account",
    title: "Account and privacy",
    blurb: "Your email, data and sign-out.",
    questions: [
      {
        id: "account-change",
        question: "What can I change in Account?",
        answer:
          "You can change your email, export your data, sign out or delete the account.",
      },
      {
        id: "account-language",
        question: "Can I switch the language?",
        answer: "The language switch is stored. The product stays in English.",
      },
      {
        id: "account-settings",
        question: "What are the Settings sections?",
        answer:
          "Preferences, Coach, Integrations, Usage and limits, Billing and Account.",
      },
    ],
  },
]

export function filterHelpTopics(
  topics: readonly HelpTopic[],
  query: string
): readonly HelpTopic[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return topics
  const matched: HelpTopic[] = []
  for (const topic of topics) {
    const label = `${topic.title} ${topic.blurb}`.toLowerCase()
    if (label.includes(needle)) {
      matched.push(topic)
      continue
    }
    const questions = topic.questions.filter((item) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(needle)
    )
    if (questions.length > 0) matched.push({ ...topic, questions })
  }
  return matched
}
