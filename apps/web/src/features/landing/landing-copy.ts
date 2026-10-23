export const LANDING_HEADLINE = "The career coach that gets you your first job."

export const LANDING_SUBHEAD =
  "Chat with a coach, write your CV and letters, track every application, and share a portfolio page."

export const LANDING_PILLARS = [
  {
    title: "Knows your story",
    body: "Answers come from your own CV, goals and applications.",
  },
  {
    title: "Writes with you",
    body: "Drafts CVs and letters beside you and edits them in place.",
  },
  {
    title: "Tracks every application",
    body: "Keeps every job, date and follow-up in one place.",
  },
] as const

type Shot = {
  src: string
  mobileSrc: string
  width: number
  height: number
  mobileWidth: number
  mobileHeight: number
  alt: string
}

export type LandingSurface = {
  id: "coach" | "paper" | "apply" | "pitch"
  title: string
  body: string
  shot: Shot
}

export const LANDING_HERO_SHOT: Shot = {
  src: "/landing/coach.webp",
  mobileSrc: "/landing/coach-mobile.webp",
  width: 1600,
  height: 900,
  mobileWidth: 768,
  mobileHeight: 600,
  alt: "OpenCV Home with a greeting, a question about what you are aiming for, and the Coach message box.",
}

export const LANDING_SURFACES: readonly LandingSurface[] = [
  {
    id: "coach",
    title: "Coach",
    body: "Ask anything about your career. Get an answer built on your own CV and goals.",
    shot: {
      src: "/landing/coach-thread.webp",
      mobileSrc: "/landing/coach-thread-mobile.webp",
      width: 1600,
      height: 383,
      mobileWidth: 768,
      mobileHeight: 410,
      alt: "A Coach thread. You ask for interview prep, the Coach checks your Apply cards and replies with a next step.",
    },
  },
  {
    id: "paper",
    title: "Paper",
    body: "Write CVs, cover letters and proofs with a coach beside you. Edit, tailor and export.",
    shot: {
      src: "/landing/paper.webp",
      mobileSrc: "/landing/paper-mobile.webp",
      width: 1600,
      height: 633,
      mobileWidth: 792,
      mobileHeight: 700,
      alt: "The Paper editor with a sample CV open, and a template picker, Tailor for role and Export above the page.",
    },
  },
  {
    id: "apply",
    title: "Apply",
    body: "Track every job you pursue on one board, from first look to final answer.",
    shot: {
      src: "/landing/apply.webp",
      mobileSrc: "/landing/apply-mobile.webp",
      width: 1600,
      height: 467,
      mobileWidth: 660,
      mobileHeight: 340,
      alt: "The Apply board with job cards in the Inbox, Prep, Sent and Closed columns.",
    },
  },
  {
    id: "pitch",
    title: "Pitch",
    body: "Turn your best work into a page you can share with one link.",
    shot: {
      src: "/landing/pitch.webp",
      mobileSrc: "/landing/pitch-mobile.webp",
      width: 960,
      height: 700,
      mobileWidth: 640,
      mobileHeight: 680,
      alt: "A public Pitch page with a name, story highlights and cards of work.",
    },
  },
]

export const LANDING_CTA = "Your career, started. Free today."
