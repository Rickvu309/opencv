export const LANDING_HEADLINE_LINES = [
  "Get your butt",
  "in your dream seat.",
] as const

export const LANDING_HEADLINE = `${LANDING_HEADLINE_LINES[0]} ${LANDING_HEADLINE_LINES[1]}`

export const LANDING_SUBHEAD =
  "Turn what you’ve done into proof. Turn proof into interviews."

export const LANDING_STATEMENT_LEAD = "You’ve done more than your CV says."

export const LANDING_STATEMENT_REST =
  "OpenCV helps you say it properly: clear proof of your work, then a CV, letter and page for the role you want."

export const LANDING_CLOSE_LINES = [
  "Be the obvious hire.",
  "Start today.",
] as const

export const LANDING_CTA = `${LANDING_CLOSE_LINES[0]} ${LANDING_CLOSE_LINES[1]}`

export const LANDING_PRIMARY_LABEL = "Get started"

export const LANDING_LOGIN_LABEL = "Log in"

export const LANDING_TITLE = "OpenCV — Get your butt in your dream seat."

export const LANDING_DESCRIPTION = `${LANDING_SUBHEAD} ${LANDING_STATEMENT_REST}`

export type Shot = {
  src: string
  mobileSrc: string
  width: number
  height: number
  mobileWidth: number
  mobileHeight: number
  alt: string
}

export type LandingAnchor = {
  kind: "anchor"
  label: string
  href: "#product" | "#coach" | "#paper" | "#apply" | "#pitch"
}

export type LandingRouteLink = {
  kind: "route"
  label: string
  to: "/sign-in" | "/sign-up"
}

export type LandingLink = LandingAnchor | LandingRouteLink

export const LANDING_CHAIR: Shot = {
  src: "/landing/chair.webp",
  mobileSrc: "/landing/chair.webp",
  width: 1080,
  height: 1976,
  mobileWidth: 1080,
  mobileHeight: 1976,
  alt: "A tan leather armchair with a dark frame against blue wooden doors.",
}

type SurfaceId = "coach" | "paper" | "apply" | "pitch"

export type LandingSurface = {
  id: SurfaceId
  label: "Coach" | "Paper" | "Apply" | "Pitch"
  title: string
  body: string
  features: readonly string[]
  shots: readonly Shot[]
}

const COACH_THREAD: Shot = {
  src: "/landing/coach.webp",
  mobileSrc: "/landing/coach-mobile.webp",
  width: 1440,
  height: 705,
  mobileWidth: 640,
  mobileHeight: 862,
  alt: "A Coach thread. Linh, a student, asks which role to apply for first, and the Coach checks her Apply cards and names one, citing her CV.",
}

const COACH_ACT: Shot = {
  src: "/landing/coach-act.webp",
  mobileSrc: "/landing/coach-act-mobile.webp",
  width: 1600,
  height: 338,
  mobileWidth: 780,
  mobileHeight: 804,
  alt: "A Coach reply beside the Apply board. Linh asks the Coach to move the Associate PM intern card to Prep, the receipt has an Undo button, and the card shows in the Prep column.",
}

export const LANDING_SURFACES: readonly LandingSurface[] = [
  {
    id: "coach",
    label: "Coach",
    title: "Capture your work",
    body: "Tell the Coach what you have done. It asks from your CV and goals. When it changes your board, you get a receipt you can undo.",
    features: [
      "Questions from your CV and goals",
      "A thread you can read back",
      "Receipts you can undo",
    ],
    shots: [COACH_THREAD, COACH_ACT],
  },
  {
    id: "paper",
    label: "Paper",
    title: "Write with a coach",
    body: "Pick a bullet on the CV. The Coach can rewrite it, and you edit the result. A Letter for that role can use the same line.",
    features: ["CV", "Letter", "Proof", "You edit every line"],
    shots: [
      {
        src: "/landing/paper.webp",
        mobileSrc: "/landing/paper-mobile.webp",
        width: 1600,
        height: 1041,
        mobileWidth: 780,
        mobileHeight: 1353,
        alt: "The Paper editor with Linh Tran's CV open and the Coach panel beside it, showing a reply about the selected bullet.",
      },
    ],
  },
  {
    id: "apply",
    label: "Apply",
    title: "Plan your search",
    body: "See every application on one board: Inbox, Prep, Sent, Live, or Closed. You move the card. Sent means you marked it sent.",
    features: [
      "Inbox, Prep, Sent, Live, Closed",
      "You or the Coach moves the card",
      "Undo puts it back",
    ],
    shots: [
      {
        src: "/landing/apply.webp",
        mobileSrc: "/landing/apply-mobile.webp",
        width: 1600,
        height: 467,
        mobileWidth: 760,
        mobileHeight: 440,
        alt: "The Apply board with a Business analyst intern job in Inbox, an Associate PM intern job in Prep and a UX research intern job in Sent.",
      },
    ],
  },
  {
    id: "pitch",
    label: "Pitch",
    title: "Share your work",
    body: "When a CV is not enough, send one public link. The page shows the projects, the story, and an About section you choose.",
    features: ["One public link", "Projects behind the CV", "Story and About"],
    shots: [
      {
        src: "/landing/pitch.webp",
        mobileSrc: "/landing/pitch-mobile.webp",
        width: 1080,
        height: 750,
        mobileWidth: 780,
        mobileHeight: 1060,
        alt: "A public Pitch page for Linh Tran, a student aiming for a product intern role, with an open-to-internships status, story highlights and an About section.",
      },
    ],
  },
]

export const LANDING_NAV_ANCHORS: readonly LandingAnchor[] = [
  { kind: "anchor", label: "Product", href: "#product" },
  { kind: "anchor", label: "Coach", href: "#coach" },
  { kind: "anchor", label: "Paper", href: "#paper" },
  { kind: "anchor", label: "Apply", href: "#apply" },
  { kind: "anchor", label: "Pitch", href: "#pitch" },
]

export const LANDING_AUTH_LINKS: readonly LandingRouteLink[] = [
  { kind: "route", label: LANDING_LOGIN_LABEL, to: "/sign-in" },
  { kind: "route", label: LANDING_PRIMARY_LABEL, to: "/sign-up" },
]
