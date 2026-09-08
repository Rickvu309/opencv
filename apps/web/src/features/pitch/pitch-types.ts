export type {
  PitchAchievement,
  PitchBentoCard,
  PitchBlock,
  PitchBlockKind,
  PitchDocument,
  PitchExperience,
  PitchFile,
  PitchGalleryItem,
  PitchLink,
  PitchStoryHighlight,
  PitchStorySlide,
  PitchTone,
  PitchWorkDoc,
} from "@workspace/domain"

import type {
  PitchBentoCard,
  PitchBlockKind,
  PitchDocument,
  PitchLink,
  PitchTone,
  PitchWorkDoc,
} from "@workspace/domain"

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
    username: string
    connected: boolean
  }
}

export type PitchIdentity = {
  name: string
  email: string
  image?: string | null
}

export const PITCH_TONE_CLASS: Record<PitchTone, string> = {
  warm: "[background-image:var(--pitch-tone-warm)]",
  cool: "[background-image:var(--pitch-tone-cool)]",
  neutral: "[background-image:var(--pitch-tone-neutral)]",
  emerald: "[background-image:var(--pitch-tone-emerald)]",
  dark: "[background-image:var(--pitch-tone-dark)]",
} as const

export function pitchToneClass(tone?: PitchTone | string) {
  if (tone && tone in PITCH_TONE_CLASS) {
    return PITCH_TONE_CLASS[tone as PitchTone]
  }
  return PITCH_TONE_CLASS.neutral
}

export function pitchHandle(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function pitchProfileFromIdentity(
  identity: PitchIdentity,
  content: PitchDocument
): PitchProfile {
  const handle = pitchHandle(identity.name) || "you"
  const githubUsername = content.github.username || `${handle}-uit`

  return {
    name: identity.name,
    legalName: identity.name,
    headline: content.headline,
    location: content.location,
    slug: `openpath.app/u/${handle}`,
    status: content.status,
    avatar: identity.image ?? "",
    about: content.about,
    published: content.published,
    github: {
      username: githubUsername,
      connected: content.github.connected,
    },
  }
}

export function overlayPitchBento(
  cards: PitchBentoCard[],
  identity: PitchIdentity,
  githubUsername: string
): PitchBentoCard[] {
  return cards.map((card) => {
    if (card.kind === "visual" && card.title === "Your name") {
      return { ...card, title: identity.name }
    }
    if (card.kind === "link" && card.title === "@github") {
      return { ...card, title: `@${githubUsername}` }
    }
    return card
  })
}

export function overlayPitchLinks(
  links: PitchLink[],
  identity: PitchIdentity,
  githubUsername: string
): PitchLink[] {
  const handle = pitchHandle(identity.name) || "you"
  return links.map((link) => {
    if (link.icon === "mail") {
      return { ...link, href: `mailto:${identity.email}` }
    }
    if (link.icon === "github") {
      return { ...link, href: `https://github.com/${githubUsername}` }
    }
    if (link.icon === "linkedin") {
      return { ...link, href: `https://linkedin.com/in/${handle}` }
    }
    return link
  })
}

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
  const typeColors: Record<PitchWorkDoc["type"], string> = {
    cv: pitchToneClass("cool"),
    letter: pitchToneClass("neutral"),
    proof: pitchToneClass("emerald"),
  }
  return {
    gradient: typeColors[doc.type],
    badge:
      doc.type === "cv" ? "CV" : doc.type === "letter" ? "Letter" : "Proof",
  }
}
