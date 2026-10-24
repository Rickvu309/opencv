export const LANDING_HEADLINE =
  "A first-job coach for Vietnamese students and new graduates."

export const LANDING_SUBHEAD =
  "OpenCV is a coach with a CV editor, an application board and a public page for your work. You write the CV with the coach, then send each application and track every answer."

export const LANDING_OBJECTION =
  "Answers come from your CV and goals, and you edit every line."

export const LANDING_PRIMARY_LABEL = "Start with a coach"

export type Shot = {
  src: string
  mobileSrc: string
  width: number
  height: number
  mobileWidth: number
  mobileHeight: number
  alt: string
  displayWidth?: number
}

export type LandingSurface = {
  id: "coach" | "paper" | "apply" | "pitch"
  label: string
  title: string
  body: string
  shot: Shot
}

export const LANDING_HERO_SHOT: Shot = {
  src: "/landing/coach.webp",
  mobileSrc: "/landing/coach-mobile.webp",
  width: 1440,
  height: 705,
  mobileWidth: 780,
  mobileHeight: 900,
  displayWidth: 960,
  alt: "A Coach thread. Linh, a student, asks which role to apply for first, and the Coach checks her Apply cards and names one, citing her CV.",
}

export const LANDING_SURFACES: readonly LandingSurface[] = [
  {
    id: "coach",
    label: "Coach",
    title: "Find the role to apply for.",
    body: "First, pick one job: the coach names it from your CV and goals and files it on your board. Every move shows a receipt you can undo.",
    shot: {
      src: "/landing/coach-act.webp",
      mobileSrc: "/landing/coach-act-mobile.webp",
      width: 1440,
      height: 600,
      mobileWidth: 780,
      mobileHeight: 900,
      displayWidth: 960,
      alt: "A Coach thread. Linh asks the Coach to move the Associate PM intern card to Prep, and the Coach shows a receipt with an Undo button.",
    },
  },
  {
    id: "paper",
    label: "Paper",
    title: "Write the CV beside the coach.",
    body: "Then send a CV written for that job. Pick a bullet, ask the coach to rewrite it, and edit the result.",
    shot: {
      src: "/landing/paper.webp",
      mobileSrc: "/landing/paper-mobile.webp",
      width: 1600,
      height: 1041,
      mobileWidth: 790,
      mobileHeight: 710,
      alt: "The Paper editor with Linh Tran's CV open beside the Coach, which has rewritten a bullet about classmate interviews into a one-page product spec.",
    },
  },
  {
    id: "apply",
    label: "Apply",
    title: "Track every application.",
    body: "Next, see where each application stands: Inbox, Prep, Sent, Live or Closed. Move cards as answers arrive.",
    shot: {
      src: "/landing/apply.webp",
      mobileSrc: "/landing/apply-mobile.webp",
      width: 1600,
      height: 467,
      mobileWidth: 760,
      mobileHeight: 440,
      alt: "The Apply board with a Business analyst intern job in Inbox, an Associate PM intern job in Prep and a UX research intern job in Sent.",
    },
  },
  {
    id: "pitch",
    label: "Pitch",
    title: "Share one page of your work.",
    body: "Last, show what a CV cannot: your projects, in one page you can link. Send it with every application.",
    shot: {
      src: "/landing/pitch.webp",
      mobileSrc: "/landing/pitch-mobile.webp",
      width: 1080,
      height: 750,
      mobileWidth: 780,
      mobileHeight: 1060,
      displayWidth: 720,
      alt: "A public Pitch page for Linh Tran, a student aiming for a product intern role, with an open-to-internships status, story highlights and an About section.",
    },
  },
]

export const LANDING_CTA =
  "Write the CV, send it, and keep every answer in one place. Free today."

export const LANDING_TITLE =
  "OpenCV, a first-job coach for Vietnamese students and new graduates"
