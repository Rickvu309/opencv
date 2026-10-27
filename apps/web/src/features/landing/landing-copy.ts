export const LANDING_HEADLINE_LINES = [
  "Get your butt",
  "in your dream seat.",
] as const

export const LANDING_HEADLINE = `${LANDING_HEADLINE_LINES[0]} ${LANDING_HEADLINE_LINES[1]}`

export const LANDING_SUBHEAD =
  "Turn what you’ve done into proof. Turn proof into interviews."

export const LANDING_STATEMENT_LEAD = "You’ve done more than your CV says."

export const LANDING_STATEMENT_REST =
  "opencv helps you say it properly: clear proof of your work, then a CV, letter and site written for each role you want."

export const LANDING_CLOSE = "Be the obvious hire. Start today."

export const LANDING_PRIMARY_LABEL = "Get started"

export const LANDING_LOGIN_LABEL = "Log in"

export const LANDING_SAMPLE_LABEL = "See a sample"

export const LANDING_TITLE = "opencv. Get your butt in your dream seat."

export const LANDING_DESCRIPTION = `${LANDING_SUBHEAD} ${LANDING_STATEMENT_REST}`

export const LANDING_LOGO_LABEL = "PEOPLE USING OPENCV HAVE INTERVIEWED AT"

export const LANDING_LOGOS = [
  "Stripe",
  "Figma",
  "Notion",
  "Vercel",
  "Airbnb",
  "Shopify",
  "Coinbase",
] as const

export type LandingNavLink = {
  label: "Product" | "Examples" | "Stories" | "Pricing"
  href: "/#product" | "/#capture" | "/#stories" | "/pricing"
}

export const LANDING_NAV_LINKS: readonly LandingNavLink[] = [
  { label: "Product", href: "/#product" },
  { label: "Examples", href: "/#capture" },
  { label: "Stories", href: "/#stories" },
  { label: "Pricing", href: "/pricing" },
]

export const LANDING_CHAIR = {
  src: "/landing/chair.webp",
  width: 1080,
  height: 1976,
  alt: "A tan leather armchair with a dark frame against blue wooden doors.",
} as const

export type LandingShot = {
  src: string
  width: number
  height: number
  alt: string
}

export type LandingFeature = {
  id: "capture" | "plan" | "assistant" | "review"
  title: string
  body: string
  features: readonly string[]
  shot: LandingShot
}

export const LANDING_FEATURES: readonly LandingFeature[] = [
  {
    id: "capture",
    title: "Capture your work",
    body: "Drop in notes, an old CV or your profile. opencv asks the right questions and turns them into clear proof.",
    features: [
      "Guided questions",
      "Import a CV",
      "Voice notes",
      "Linked sources",
    ],
    shot: {
      src: "/landing/coach.webp",
      width: 1440,
      height: 705,
      alt: "A Coach chat. Linh, a student, asks which role to apply for first, and the Coach checks her Apply cards and names one, citing her CV.",
    },
  },
  {
    id: "plan",
    title: "Plan your search",
    body: "See every role you’re going for, which of your proof fits best, and what to do next, all in one place.",
    features: [
      "Roles",
      "Applications",
      "Your proof",
      "Next steps",
      "Fit score",
      "Insights",
    ],
    shot: {
      src: "/landing/apply.webp",
      width: 1600,
      height: 467,
      alt: "The Apply board with a Business analyst intern job in Inbox, an Associate PM intern job in Prep and a UX research intern job in Sent.",
    },
  },
  {
    id: "assistant",
    title: "Your writing assistant",
    body: "Ask for a tailored CV, a cover letter or a site update. It uses only what you’ve told it, in your own voice.",
    features: ["Tailored CVs", "Cover letters", "Site updates", "Your voice"],
    shot: {
      src: "/landing/paper.webp",
      width: 1600,
      height: 1041,
      alt: "The Paper editor with Linh Tran's CV open and the Coach panel beside it, showing a reply about the selected bullet.",
    },
  },
  {
    id: "review",
    title: "Review, then send",
    body: "Check every change, see where each claim comes from, and approve it. Then send your CV and letter, or publish your site.",
    features: [
      "CV",
      "Cover letter",
      "Personal site",
      "Versions",
      "Changes",
      "Publishing",
    ],
    shot: {
      src: "/landing/coach-act.webp",
      width: 1600,
      height: 338,
      alt: "A Coach reply beside the Apply board. Linh asks the Coach to move a job, the receipt has an Undo button, and she can approve the change.",
    },
  },
]

export const LANDING_QUOTES = [
  {
    quote:
      "I stopped sending the same CV to everyone. Every application now starts from what I actually did.",
    name: "Maya T.",
    role: "Product Designer",
  },
  {
    quote:
      "It made me say the numbers out loud. I was calmer in every interview.",
    name: "Daniel K.",
    role: "Staff Engineer",
  },
] as const

export const LANDING_CUSTOMERS_LINE =
  "opencv helps people go from a first note to an offer. From first jobs to senior roles."

export const LANDING_CUSTOMERS_LABEL = "Customer stories"

export type FooterLink = {
  label: string
  href: string
}

export type FooterColumn = {
  heading: string
  links: readonly FooterLink[]
}

export const LANDING_FOOTER: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Proof vault", href: "/#benefits" },
      { label: "CV and letters", href: "/#assistant" },
      { label: "Personal site", href: "/#review" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Features",
    links: [
      { label: "Proof interviews", href: "/#benefits" },
      { label: "Tailored CVs", href: "/#assistant" },
      { label: "Cover letters", href: "/#assistant" },
      { label: "Reviews", href: "/#review" },
      { label: "Imports", href: "/#capture" },
    ],
  },
  {
    heading: "Company",
    links: [{ label: "Stories", href: "/#stories" }],
  },
  {
    heading: "Resources",
    links: [
      { label: "CV examples", href: "/#assistant" },
      { label: "For students", href: "/#product" },
    ],
  },
]

export const PRICING_TITLE = "opencv. Pricing"

export const PRICING_HEADLINE = "Pricing"

export const PRICING_SUBHEAD = "Start free. Upgrade when you need more Coach."

export const PRICING_DESCRIPTION = `${PRICING_SUBHEAD} Free is $0 a month. Pro is $9 a month.`

export const PRICING_FREE = {
  name: "Free",
  audience: "Try opencv with no card.",
  price: "$0",
  period: "per month",
  cta: "Start free",
  note: "No credit card required",
  features: [
    "Limited Coach chats",
    "Basic Coach model",
    "CVs and cover letters in Paper",
    "Board, list and calendar in Apply",
    "Integrations",
  ],
} as const

export const PRICING_PRO = {
  name: "Pro",
  kicker: "For active search",
  audience: "For when you apply every week.",
  price: "$9",
  period: "per month",
  cta: "Get Pro",
  note: "Cancel anytime",
  features: [
    "Everything in Free, plus",
    "Unlimited Coach chats",
    "Stronger Coach model",
    "Priority support",
    "Early access to Proof and Pitch",
  ],
} as const

export const PRICING_INCLUDED = [
  {
    title: "Paper",
    body: "Write and tailor CVs and letters.",
  },
  {
    title: "Apply",
    body: "Track every job from Saved to Offer.",
  },
  {
    title: "Calendar",
    body: "Interviews and deadlines in one view.",
  },
  {
    title: "Integrations",
    body: "Gmail, Calendar, Drive and more.",
  },
] as const

export type CompareCell = "Included" | "Not included" | string

export type CompareRow = {
  feature: string
  free: CompareCell
  pro: CompareCell
}

export type CompareGroup = {
  group: string
  rows: readonly CompareRow[]
}

export const PRICING_COMPARE: readonly CompareGroup[] = [
  {
    group: "Coach",
    rows: [
      { feature: "Chats", free: "Limited", pro: "Unlimited" },
      { feature: "Model", free: "Basic", pro: "Stronger" },
      {
        feature: "Instructions and memory",
        free: "Included",
        pro: "Included",
      },
    ],
  },
  {
    group: "Paper",
    rows: [
      {
        feature: "CVs and cover letters",
        free: "Included",
        pro: "Included",
      },
      { feature: "Templates", free: "Basic", pro: "All" },
      {
        feature: "Export to PDF and DOCX",
        free: "Included",
        pro: "Included",
      },
    ],
  },
  {
    group: "Apply",
    rows: [
      {
        feature: "Board, list and calendar",
        free: "Included",
        pro: "Included",
      },
      {
        feature: "Job details and interview prep",
        free: "Included",
        pro: "Included",
      },
    ],
  },
  {
    group: "Integrations",
    rows: [{ feature: "Integrations", free: "Included", pro: "Included" }],
  },
  {
    group: "Support",
    rows: [
      { feature: "Help centre", free: "Included", pro: "Included" },
      {
        feature: "Priority support",
        free: "Not included",
        pro: "Coming soon",
      },
    ],
  },
  {
    group: "Proof",
    rows: [{ feature: "Proof", free: "Not included", pro: "Early access" }],
  },
  {
    group: "Pitch",
    rows: [{ feature: "Pitch", free: "Not included", pro: "Early access" }],
  },
]

export const PRICING_FAQ = [
  {
    q: "What happens when I hit the Free limit?",
    a: "Coach pauses until your limit resets. Paper and Apply keep working.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Pro stays on until the end of your billing month.",
  },
  {
    q: "Is my data used to train models?",
    a: "No. Your CVs, jobs and chats are never used to train models.",
  },
  {
    q: "How do I pay?",
    a: "By card, billed monthly in USD. Local taxes may apply.",
  },
  {
    q: "What is coming to Pro?",
    a: "Proof and Pitch. Pro members get them first.",
  },
] as const

export const PRICING_FOOTER: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Paper", href: "/#assistant" },
      { label: "Apply", href: "/#plan" },
      { label: "Coach", href: "/#capture" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [{ label: "Stories", href: "/#stories" }],
  },
]

export const PRICING_TAGLINE = "Show your work. Get the job."

export const LANDING_COPYRIGHT = "© 2026 opencv"
