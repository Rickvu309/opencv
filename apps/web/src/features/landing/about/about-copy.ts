export const ABOUT_TITLE = "opencv. About"

export const ABOUT_DESCRIPTION =
  "A career coach inside a working product, for students and new graduates in Vietnam."

export const ABOUT_HEADLINE = "About opencv"

export const ABOUT_LEDE = ABOUT_DESCRIPTION

export const ABOUT_STORY = {
  title: "Why we built it",
  paragraphs: [
    "Most early-career CVs list duties. You have done more than that list shows.",
    "Hiring is a sale to one buyer. You write a CV and a letter for that role.",
    "opencv helps you show what you did, for each role. Show your work. Get the job.",
  ],
} as const

export const ABOUT_BELIEFS_TITLE = "What we believe"

export const ABOUT_PRINCIPLES = [
  {
    id: "work",
    title: "Show the work",
    line: "Name what you did on that job.",
    figure:
      "A CV page with uneven lines and a small proof block on the corner.",
  },
  {
    id: "cv",
    title: "One CV per job",
    line: "Keep a CV and a letter for each role.",
    figure: "One CV page beside a single job card.",
  },
  {
    id: "coach",
    title: "You stay in charge",
    line: "Coach does the work while you watch, and nothing is sent without your click.",
    figure:
      "A screen of steps, a letter waiting on the desk, and a button that has not been pressed.",
  },
  {
    id: "data",
    title: "Your data is yours",
    line: "Export your data, or delete the account, in Settings.",
    figure: "A closed case with a handle, holding your papers.",
  },
] as const

export type AboutPrincipleId = (typeof ABOUT_PRINCIPLES)[number]["id"]

export const ABOUT_HOW_TITLE = "How it works"

export const ABOUT_SURFACES = [
  {
    id: "paper",
    title: "Paper",
    line: "Write a CV and a letter for each job.",
    hash: "paper",
  },
  {
    id: "apply",
    title: "Apply",
    line: "Track each job from Saved to Offer.",
    hash: "apply",
  },
  {
    id: "coach",
    title: "Coach",
    line: "Ask in plain words. Coach does the work while you watch.",
    hash: "coach",
  },
] as const

export const ABOUT_NEXT = {
  title: "What is next",
  line: "Two new ways to show your work. Proof turns a CV line into evidence. Pitch is your CV and Proofs on one page.",
} as const
