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

import {
  alignStoryChipIdentity,
  emptyPitchDocument,
  isLeftoverPitchGithubUsername,
  isLeftoverPitchPersonaName,
  pitchHandle,
  type PitchBentoCard,
  type PitchBlockKind,
  type PitchDocument,
  type PitchLink,
  type PitchStoryHighlight,
  type PitchTone,
  type PitchWorkDoc,
} from "@workspace/domain"

export { isPitchPublicSlug, pitchHandle } from "@workspace/domain"

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

export function publicPitchPath(slug: string) {
  return `/u/${slug}`
}

export function publicPitchHref(
  slug: string,
  origin = typeof window === "undefined" ? "" : window.location.origin
) {
  return `${origin}${publicPitchPath(slug)}`
}

export function publicPitchLabel(slug: string) {
  return `opencv.me/u/${slug}`
}

export function pitchProfileFromIdentity(
  identity: PitchIdentity,
  content: PitchDocument
): PitchProfile {
  const handle = pitchHandle(identity.name) || "you"
  const storedUsername = content.github.username
  const githubUsername =
    storedUsername && !isLeftoverPitchGithubUsername(storedUsername)
      ? storedUsername
      : `${handle}-uit`

  return {
    name: identity.name,
    legalName: identity.name,
    headline: content.headline,
    location: content.location,
    slug: publicPitchLabel(handle),
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
  githubUsername: string,
  highlights: PitchStoryHighlight[] = []
): PitchBentoCard[] {
  const aligned = alignStoryChipIdentity({
    ...emptyPitchDocument(),
    bento: cards,
    storyHighlights: highlights,
  }).bento

  return aligned.map((card) => {
    if (
      card.kind === "visual" &&
      (card.title === "Your name" || isLeftoverPitchPersonaName(card.title))
    ) {
      return { ...card, title: identity.name }
    }
    if (
      card.kind === "link" &&
      (card.title === "@github" || isLeftoverPitchGithubUsername(card.title))
    ) {
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
  moments: "Story highlights and a grid of work moments.",
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
