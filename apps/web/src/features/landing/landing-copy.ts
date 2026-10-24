export const LANDING_HEADLINE =
  "A first-job coach for Vietnamese students and new graduates."

export const LANDING_SUBHEAD =
  "OpenCV is one workspace for your job search, with a coach beside you. You write your CV with the coach, then track each application and share one page of your work."

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
  width: 1600,
  height: 573,
  mobileWidth: 780,
  mobileHeight: 820,
  alt: "A Coach thread. Linh, a student, asks for help preparing for a product intern interview, and the Coach checks her Apply cards and replies with a next step.",
}

export const LANDING_SURFACES: readonly LandingSurface[] = [
  {
    id: "coach",
    label: "Coach",
    title: "Ask about the role you want.",
    body: "First, name the job you want. The coach answers from your own CV and goals and ends with a next step.",
    shot: {
      src: "/landing/coach-home.webp",
      mobileSrc: "/landing/coach-home-mobile.webp",
      width: 1600,
      height: 640,
      mobileWidth: 780,
      mobileHeight: 1080,
      alt: "OpenCV Home for Linh Tran, a student. The Coach asks what she is aiming for and offers prompts such as Prep interview and Draft cover letter.",
    },
  },
  {
    id: "paper",
    label: "Paper",
    title: "Write the CV beside the coach.",
    body: "Then write your CV with a coach beside you. Tailor it to each role and export it.",
    shot: {
      src: "/landing/paper.webp",
      mobileSrc: "/landing/paper-mobile.webp",
      width: 1600,
      height: 1000,
      mobileWidth: 780,
      mobileHeight: 1010,
      alt: "The Paper editor with Linh Tran's CV open: a student summary and a campus product club role, with a template picker, Tailor for role and Export above the page.",
    },
  },
  {
    id: "apply",
    label: "Apply",
    title: "Track every application.",
    body: "Next, keep each job you apply for on one board. Move cards from first look to final answer.",
    shot: {
      src: "/landing/apply.webp",
      mobileSrc: "/landing/apply-mobile.webp",
      width: 1600,
      height: 467,
      mobileWidth: 760,
      mobileHeight: 440,
      alt: "The Apply board with an Associate PM intern job in Inbox and a Business analyst intern job in Prep, beside the Sent, Live and Closed columns.",
    },
  },
  {
    id: "pitch",
    label: "Pitch",
    title: "Share one page of your work.",
    body: "Last, turn your best work into one page. Send the link with every application.",
    shot: {
      src: "/landing/pitch.webp",
      mobileSrc: "/landing/pitch-mobile.webp",
      width: 1080,
      height: 750,
      mobileWidth: 780,
      mobileHeight: 1060,
      displayWidth: 720,
      alt: "A public Pitch page for Linh Tran, a student aiming for a product intern role, with a status line, story highlights and an About section.",
    },
  },
]

export const LANDING_CTA = "Your career, started. Free today."

export const LANDING_TITLE =
  "OpenCV, a first-job coach for Vietnamese students and new graduates"
