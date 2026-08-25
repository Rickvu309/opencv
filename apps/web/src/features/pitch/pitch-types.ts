import {
  SAMPLE_AUTHOR,
  type SampleAuthor,
} from "@/features/seed/sample-author.ts"

export type PitchBlockKind =
  | "about"
  | "achievements"
  | "experience"
  | "work"
  | "github"
  | "contact"
  | "moments"
  | "gallery"

export type PitchBlock = {
  id: string
  kind: PitchBlockKind
  hidden?: boolean
}

export type PitchAchievement = {
  id: string
  year: string
  title: string
  context: string
  description: string
  link?: string
  linkLabel?: string
  tag?: string
}

export type PitchExperience = {
  id: string
  period: string
  title: string
  org: string
  summary: string
}

export type PitchGalleryItem = {
  id: string
  caption: string
  tone: "warm" | "cool" | "neutral"
}

export type PitchStorySlide = {
  id: string
  caption: string
  detail?: string
  tone: "warm" | "cool" | "neutral" | "emerald"
  durationMs?: number
  /** Achievement / work photo (local assets) */
  image?: string
}

export type PitchStoryHighlight = {
  id: string
  label: string
  coverTone: "warm" | "cool" | "neutral" | "emerald"
  coverImage?: string
  slides: PitchStorySlide[]
}

export type PitchBentoCard = {
  id: string
  kind: "quote" | "stat" | "link" | "story" | "visual"
  title: string
  body?: string
  meta?: string
  tone?: "warm" | "cool" | "neutral" | "dark" | "emerald"
  span?: "tall" | "wide" | "normal"
  storyHighlightId?: string
  image?: string
}

export type PitchFile = {
  id: string
  name: string
  meta: string
  kind: "pdf" | "fig" | "sheet" | "zip"
}

export type PitchLink = {
  id: string
  label: string
  href: string
  icon: "github" | "linkedin" | "mail" | "link"
}

export type PitchWorkDocType = "cv" | "letter" | "proof"
export type PitchWorkDocStatus = "draft" | "ready" | "published"

export type PitchWorkDoc = {
  id: string
  name: string
  type: PitchWorkDocType
  status: PitchWorkDocStatus
  updated: string
}

export type GithubContribution = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export type PitchProfile = {
  name: string
  legalName: string
  headline: string
  location: string
  slug: string
  status: string
  avatar: string
  about: string
  published: boolean
  github: {
    /** Placeholder handle — mock integration only */
    username: string
    connected: boolean
  }
}

export function pitchHandle(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function createPitchProfile(author: SampleAuthor): PitchProfile {
  const handle = pitchHandle(author.name) || "you"

  return {
    name: author.name,
    legalName: author.name,
    headline: "Aspiring product manager · UIT Information Systems",
    location: "HCMC · open to intern roles",
    slug: `openpath.app/u/${handle}`,
    status: "Open to associate PM & product intern roles · Summer 2026",
    avatar: author.avatarSrc,
    published: true,
    about: `I learn product by shipping small experiments — checkout UX studies, onboarding teardowns, and club-led discovery sprints.

I'm looking for a team that values evidence over slide decks. CV and case studies are below.`,
    github: {
      username: `${handle}-uit`,
      connected: true,
    },
  }
}

export function getPitchProfile() {
  return createPitchProfile(SAMPLE_AUTHOR)
}

/** Vertical showcase order (Read.cv-style scan path). */
export const PITCH_BLOCKS: PitchBlock[] = [
  { id: "b-moments", kind: "moments" },
  { id: "b-about", kind: "about" },
  { id: "b-achievements", kind: "achievements" },
  { id: "b-experience", kind: "experience" },
  { id: "b-work", kind: "work" },
  { id: "b-github", kind: "github" },
  { id: "b-contact", kind: "contact" },
]

export const PITCH_ACHIEVEMENTS: PitchAchievement[] = [
  {
    id: "a1",
    year: "2025",
    title: "Checkout card resize study",
    context: "Side project",
    description:
      "Ran a 12-person hallway test on two mobile checkout layouts. Shorter card + sticky CTA lifted add-to-cart taps by 18%. Documented as a Proof chain.",
    link: "#",
    linkLabel: "Read case study",
    tag: "UX research",
  },
  {
    id: "a2",
    year: "2025",
    title: "Wallet onboarding audit",
    context: "Fintech teardown",
    description:
      "Mapped friction across three wallet apps, then prototyped a shorter KYC path with classmates. Presented findings at UIT Product Club.",
    tag: "Product critique",
  },
  {
    id: "a3",
    year: "2024",
    title: "Campus expense app",
    context: "UIT Product Club",
    description:
      "Led discovery for a student expense splitter — 8 interviews, PRD, and a shipped Figma prototype in three weeks.",
    tag: "Shipped prototype",
  },
]

export const PITCH_EXPERIENCE: PitchExperience[] = [
  {
    id: "e1",
    period: "2024 – now",
    title: "Product discovery lead",
    org: "UIT Product Club",
    summary:
      "Weekly user interviews, prioritisation workshops, and PRDs for campus-side projects.",
  },
  {
    id: "e2",
    period: "2023 – 2024",
    title: "Information Systems",
    org: "University of Information Technology",
    summary: "GPA 3.4 · focus on systems analysis, SQL, and product electives.",
  },
]

export const PITCH_STORY_HIGHLIGHTS: PitchStoryHighlight[] = [
  {
    id: "sh-checkout",
    label: "Checkout",
    coverTone: "emerald",
    coverImage: "/pitch/stories/mobile-checkout.jpg",
    slides: [
      {
        id: "s1",
        caption: "Hallway test setup",
        detail: "12 participants · two mobile layouts · 15 min each",
        tone: "warm",
        image: "/pitch/stories/hallway-test.jpg",
      },
      {
        id: "s2",
        caption: "Variant B — shorter card",
        detail: "Sticky CTA + tighter image ratio",
        tone: "neutral",
        image: "/pitch/stories/phone-ui.jpg",
      },
      {
        id: "s3",
        caption: "+18% add-to-cart taps",
        detail: "Documented as a Proof chain on Paper",
        tone: "emerald",
        durationMs: 6000,
        image: "/pitch/stories/team-win.jpg",
      },
    ],
  },
  {
    id: "sh-wallet",
    label: "Wallet audit",
    coverTone: "cool",
    coverImage: "/pitch/stories/whiteboard.jpg",
    slides: [
      {
        id: "s4",
        caption: "Friction map",
        detail: "Compared 3 wallet apps · flagged KYC drop-off",
        tone: "cool",
        image: "/pitch/stories/whiteboard.jpg",
      },
      {
        id: "s5",
        caption: "Shorter KYC prototype",
        detail: "Sketched a 4-step path with classmates",
        tone: "neutral",
        image: "/pitch/stories/team-laptop.jpg",
      },
    ],
  },
  {
    id: "sh-club",
    label: "Club sprint",
    coverTone: "warm",
    coverImage: "/pitch/stories/sprint-board.jpg",
    slides: [
      {
        id: "s6",
        caption: "Sprint board",
        detail: "UIT Product Club · week 3 of discovery",
        tone: "warm",
        image: "/pitch/stories/sprint-board.jpg",
      },
      {
        id: "s7",
        caption: "Shipped prototype",
        detail: "Campus expense app · demo day with the club",
        tone: "cool",
        image: "/pitch/stories/award-trophy.jpg",
      },
      {
        id: "s8",
        caption: "Team after demo",
        detail: "Gift from mentors · proud of the sprint",
        tone: "warm",
        image: "/pitch/stories/gift-celebration.jpg",
      },
    ],
  },
]

export function getPitchBento(profile: PitchProfile): PitchBentoCard[] {
  return [
    {
      id: "b1",
      kind: "visual",
      title: profile.name,
      body: "PM track · UIT",
      tone: "warm",
      span: "normal",
      image: "/pitch/stories/team-meeting.jpg",
    },
    {
      id: "b2",
      kind: "quote",
      title: "I ship small experiments",
      body: "Checkout UX, onboarding teardowns, club-led discovery.",
      span: "normal",
    },
    {
      id: "b3",
      kind: "stat",
      title: "+18%",
      body: "add-to-cart lift",
      meta: "Checkout study · 2025",
      tone: "emerald",
      span: "normal",
    },
    {
      id: "b4",
      kind: "story",
      title: "my sacred space",
      body: "Hallway test · late night Figma",
      tone: "cool",
      span: "tall",
      storyHighlightId: "sh-checkout",
      image: "/pitch/stories/hallway-test.jpg",
    },
    {
      id: "b5",
      kind: "link",
      title: `@${profile.github.username}`,
      body: "GitHub · mock",
      meta: "github.com",
      tone: "dark",
      span: "wide",
    },
  ]
}

export const PITCH_GALLERY: PitchGalleryItem[] = [
  { id: "g1", caption: "Hallway test", tone: "warm" },
  { id: "g2", caption: "Sprint board", tone: "cool" },
  { id: "g3", caption: "Flow maps", tone: "neutral" },
]

export function getPitchFiles(profile: PitchProfile): PitchFile[] {
  return [
    {
      id: "f1",
      name: `${profile.name} — PM CV.pdf`,
      meta: "142 KB",
      kind: "pdf",
    },
    {
      id: "f2",
      name: "Checkout study deck.fig",
      meta: "Figma",
      kind: "fig",
    },
  ]
}

export function getPitchLinks(profile: PitchProfile): PitchLink[] {
  return [
    {
      id: "l1",
      label: "GitHub",
      href: `https://github.com/${profile.github.username}`,
      icon: "github",
    },
    {
      id: "l2",
      label: "LinkedIn",
      href: `https://linkedin.com/in/${pitchHandle(profile.name)}`,
      icon: "linkedin",
    },
    {
      id: "l3",
      label: "Email",
      href: `mailto:${SAMPLE_AUTHOR.email}`,
      icon: "mail",
    },
  ]
}

/** Seed Paper docs shown on Work — local to Pitch until Paper owns the model. */
export const PITCH_WORK_DOCS: PitchWorkDoc[] = [
  {
    id: "d1",
    name: "PM track CV",
    type: "cv",
    status: "draft",
    updated: "Today",
  },
  {
    id: "d3",
    name: "Checkout card resize study",
    type: "proof",
    status: "ready",
    updated: "3 days ago",
  },
  {
    id: "d4",
    name: "Wallet onboarding audit",
    type: "proof",
    status: "draft",
    updated: "Last week",
  },
]

export const BLOCK_LABELS: Record<PitchBlockKind, string> = {
  about: "About",
  achievements: "Achievements",
  experience: "Experience",
  work: "Work & documents",
  github: "GitHub",
  contact: "Contact",
  moments: "Moments",
  gallery: "Gallery",
}

export const BLOCK_PURPOSE: Record<PitchBlockKind, string> = {
  about: "Your story in plain language.",
  achievements: "Projects and wins — the proof recruiters remember.",
  experience: "Roles, education, and orgs.",
  work: "CV, proof cards, and downloads.",
  github: "Builder activity from a linked GitHub account.",
  contact: "Email and socials — one tap to reach you.",
  moments:
    "Story highlights + bento grid — swipeable work moments like Instagram.",
  gallery: "Photos from workshops, tests, and team moments.",
}

export function paperDocPitchMeta(doc: Pick<PitchWorkDoc, "type">) {
  const typeColors = {
    cv: "from-sky-100 to-sky-50",
    letter: "from-muted to-muted/50",
    proof: "from-emerald-100 to-emerald-50",
  }
  return {
    gradient: typeColors[doc.type],
    badge:
      doc.type === "cv" ? "CV" : doc.type === "letter" ? "Letter" : "Proof",
  }
}
