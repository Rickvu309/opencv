export const LANDING_HEADLINE_LINES = [
  "Get your butt",
  "in your dream seat.",
] as const

export const LANDING_SUBHEAD =
  "Tailor your CV for every job and track every application. Prep with Coach."

export const LANDING_STATEMENT_LEAD = "You’ve done more than your CV says."

export const LANDING_STATEMENT_BRAND = "opencv helps"

export const LANDING_STATEMENT_REST =
  "you show it: a CV and letter written for each role, a board for every application, and a coach that knows both."

export const LANDING_CLOSE = "Be the obvious hire. Start today."

export const LANDING_PRIMARY_LABEL = "Get started"

export const LANDING_LOGIN_LABEL = "Log in"

export const LANDING_SAMPLE_LABEL = "See a sample"

export const LANDING_TITLE = "opencv. Get your butt in your dream seat."

export const LANDING_DESCRIPTION = `${LANDING_SUBHEAD} ${LANDING_STATEMENT_BRAND} ${LANDING_STATEMENT_REST}`

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
  label: "Product" | "Stories" | "Pricing" | "Blog" | "Help"
  href: "/#product" | "/stories" | "/pricing" | "/blog" | "/help"
}

export const LANDING_NAV_LINKS: readonly LandingNavLink[] = [
  { label: "Product", href: "/#product" },
  { label: "Stories", href: "/stories" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Help", href: "/help" },
]

export type LandingFigureId =
  "apply-board" | "paper" | "apply" | "coach" | "proof" | "pitch"

export const LANDING_FIGURE_LABELS: Record<LandingFigureId, string> = {
  "apply-board":
    "The Apply board with jobs in Saved, Applied and Interview columns, each card showing its company, city and date.",
  paper:
    "The Paper editor with Linh Nguyen's Junior Marketing CV open on a single page, with experience, education and skills.",
  apply:
    "An Apply job page for an Associate PM intern, with the role details, an interview date, a linked CV and an interview prep checklist.",
  coach:
    "A Coach chat asking for a CV for a cosmetics brand, with steps ticking off as Coach reads the CV and the posting and drafts bullet rewrites.",
  proof:
    "The Proof page, with a CV line about growing followers by 38 percent backed by a rising chart and a manager confirmation.",
  pitch:
    "The Pitch page, with a public profile for Linh Nguyen showing a Download CV button, proof charts and a view count.",
}

export type LandingBenefit = {
  title: string
  body: string
}

export const LANDING_BENEFITS = {
  cv: {
    title: "A CV for every job",
    body: "Write once in Paper, then tailor your CV and letter to each job in a minute.",
  },
  applications: {
    title: "Every application in one place",
    body: "Save jobs from any link and see what to do next on one board.",
  },
  coach: {
    title: "A coach that does the work",
    body: "Ask Coach to tailor, prep or follow up. It reads your work first.",
  },
} as const satisfies Record<string, LandingBenefit>

export type LandingSectionHeader = {
  title: string
  body: string
  link: { label: string; to: "/sign-in" | "/pricing" }
}

export type LandingProduct = {
  id: "paper" | "apply" | "coach"
  title: string
  body: string
  figure: LandingFigureId
  features: readonly [string, string, string, string]
}

export const LANDING_PRODUCTS: readonly LandingProduct[] = [
  {
    id: "paper",
    title: "Paper",
    body: "Write your CV and letters in a clean editor. Coach tailors them to each job and keeps it to one page.",
    figure: "paper",
    features: [
      "Tailored CVs",
      "Import a CV",
      "Cover letters",
      "One-page check",
    ],
  },
  {
    id: "apply",
    title: "Apply",
    body: "Save any job from a link, move it from Saved to Offer, and never miss an interview or a deadline.",
    figure: "apply",
    features: ["Board and list", "Job details", "Calendar", "Interview prep"],
  },
  {
    id: "coach",
    title: "Coach",
    body: "Ask in plain words. Coach reads your CV and the job, then does the work while you watch.",
    figure: "coach",
    features: [
      "Tailor a CV",
      "Prep an interview",
      "Write a letter",
      "Email updates",
    ],
  },
]

export const LANDING_PRODUCT_LINK = {
  label: "Learn more",
  to: "/sign-in",
} as const

export const LANDING_INTEGRATIONS_HEADER: LandingSectionHeader = {
  title: "Works with your apps",
  body: "Bring in your mail, calendar, files and profiles. Coach uses them to keep Apply up to date.",
  link: { label: "See all integrations", to: "/pricing" },
}

export const LANDING_INTEGRATIONS = [
  { id: "gmail", name: "Gmail", src: "/landing/logo-gmail.webp" },
  {
    id: "google-calendar",
    name: "Google Calendar",
    src: "/landing/logo-google-calendar.webp",
  },
  { id: "zoom", name: "Zoom", src: "/landing/logo-zoom.webp" },
  {
    id: "google-meet",
    name: "Google Meet",
    src: "/landing/logo-google-meet.webp",
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    src: "/landing/logo-microsoft-teams.webp",
  },
  { id: "drive", name: "Google Drive", src: "/landing/logo-drive.webp" },
  {
    id: "microsoft-onedrive",
    name: "Microsoft OneDrive",
    src: "/landing/logo-microsoft-onedrive.webp",
  },
  { id: "notion", name: "Notion", src: "/landing/logo-notion.webp" },
  { id: "figma", name: "Figma", src: "/landing/logo-figma.webp" },
  { id: "canva", name: "Canva", src: "/landing/logo-canva.webp" },
  { id: "linkedin", name: "LinkedIn", src: "/landing/logo-linkedin.webp" },
  { id: "github", name: "GitHub", src: "/landing/logo-github.webp" },
] as const

export const LANDING_COMING_NEXT_HEADER: LandingSectionHeader = {
  title: "Coming next",
  body: "Two new ways to show your work. Join the waitlist and get them first.",
  link: { label: "Join the waitlist", to: "/sign-in" },
}

export type LandingComingNext = {
  id: "proof" | "pitch"
  title: string
  body: string
  figure: LandingFigureId
}

export const LANDING_COMING_NEXT: readonly LandingComingNext[] = [
  {
    id: "proof",
    title: "Proof",
    body: "Turn a CV line into evidence.",
    figure: "proof",
  },
  {
    id: "pitch",
    title: "Pitch",
    body: "Your CV and Proofs on one page.",
    figure: "pitch",
  },
]

export const LANDING_STORIES = {
  lead: {
    quote:
      "I stopped listing duties and showed the one campaign I actually ran. The recruiter called me back in four days.",
    name: "Nguyễn Thảo Vy",
    role: "Brand Marketing Associate, Ho Chi Minh City",
    photo: {
      src: "/landing/story-thao-vy.webp",
      width: 496,
      height: 832,
      alt: "Portrait of Nguyễn Thảo Vy, Brand Marketing Associate.",
    },
  },
  side: {
    quote: "I sent fewer applications and treated each one like a pitch.",
    name: "Kim Ji-woo",
    role: "UX Designer, Seoul",
    photo: {
      src: "/landing/story-kim.webp",
      width: 88,
      height: 88,
      alt: "Portrait of Kim Ji-woo, UX Designer.",
    },
  },
} as const

export const LANDING_CUSTOMERS_LINE =
  "opencv helps people go from a first note to an offer. From first jobs to senior roles."

export const LANDING_CUSTOMERS_LABEL = "Customer stories"

export type FooterLink = {
  label: string
  href:
    | "/#paper"
    | "/#apply"
    | "/#coach"
    | "/stories"
    | "/pricing"
    | "/about"
    | "/blog"
}

export type FooterColumn = {
  heading: string
  links: readonly FooterLink[]
}

export const LANDING_FOOTER: readonly FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Paper", href: "/#paper" },
      { label: "Apply", href: "/#apply" },
      { label: "Coach", href: "/#coach" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Stories", href: "/stories" },
      { label: "Blog", href: "/blog" },
    ],
  },
]

export const LANDING_TAGLINE_LINES = [
  "Show your work.",
  "Get the job.",
] as const

export const PRICING_TITLE = "opencv. Pricing"

export const LANDING_COPYRIGHT = "© 2026 opencv"
