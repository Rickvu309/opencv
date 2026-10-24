import {
  DEFAULT_PITCH_BLOCKS,
  STARTER_PITCH_ABOUT_LEAD,
  STARTER_PITCH_HEADLINE,
  type PitchAchievement,
  type PitchDocument,
} from "./pitch-codecs.js"
import {
  STARTER_CHECKOUT_ACHIEVEMENT_ID,
  STARTER_CHECKOUT_ACHIEVEMENT_TITLE,
  STARTER_CHECKOUT_PROOF_ID,
} from "./starter.js"

/**
 * The full sample Pitch that accounts created before the Pitch craft pass
 * hold in their stored content. New accounts get the one-line sample from
 * `starterPitchDocument`. Kept so the heal path restores what an older
 * account actually had, and so tests can build that stored shape.
 */
function legacyCheckoutAchievement(
  id = STARTER_CHECKOUT_ACHIEVEMENT_ID
): PitchAchievement {
  return {
    id,
    year: "2025",
    title: STARTER_CHECKOUT_ACHIEVEMENT_TITLE,
    context: "Side project",
    description:
      "Ran a 12-person hallway test on two mobile checkout layouts. Shorter card + sticky CTA lifted add-to-cart taps by 18%. Documented as a Proof chain.",
    proofId: STARTER_CHECKOUT_PROOF_ID,
    tag: "UX research",
  }
}

export function legacyStarterPitchDocument(): PitchDocument {
  return {
    headline: STARTER_PITCH_HEADLINE,
    location: "HCMC · open to intern roles",
    status: "Sample — open to intern roles · Summer 2026",
    about: `${STARTER_PITCH_ABOUT_LEAD}

I learn product by shipping small experiments — checkout UX studies, onboarding teardowns, and club-led discovery sprints. Looking for a team that values evidence over slide decks.`,
    published: false,
    demo: true,
    github: {
      username: "",
      connected: true,
    },
    blocks: DEFAULT_PITCH_BLOCKS,
    achievements: [
      legacyCheckoutAchievement(),
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
    ],
    experience: [
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
        summary:
          "GPA 3.4 · focus on systems analysis, SQL, and product electives.",
      },
    ],
    storyHighlights: [
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
    ],
    bento: [
      {
        id: "b1",
        kind: "visual",
        title: "Your name",
        body: "Sample · campus club",
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
        title: "Checkout",
        body: "Hallway test setup",
        tone: "cool",
        span: "tall",
        storyHighlightId: "sh-checkout",
        image: "/pitch/stories/hallway-test.jpg",
      },
      {
        id: "b5",
        kind: "link",
        title: "@github",
        body: "GitHub · mock",
        meta: "github.com",
        tone: "dark",
        span: "wide",
      },
    ],
    gallery: [
      { id: "g1", caption: "Hallway test", tone: "warm" },
      { id: "g2", caption: "Sprint board", tone: "cool" },
      { id: "g3", caption: "Flow maps", tone: "neutral" },
    ],
    files: [
      {
        id: "f1",
        name: "Sample internship CV.pdf",
        meta: "142 KB",
        kind: "pdf",
      },
      {
        id: "f2",
        name: "Checkout study deck.fig",
        meta: "Figma",
        kind: "fig",
      },
    ],
    links: [
      {
        id: "l1",
        label: "GitHub",
        href: "https://github.com",
        icon: "github",
      },
      {
        id: "l2",
        label: "LinkedIn",
        href: "https://linkedin.com",
        icon: "linkedin",
      },
      {
        id: "l3",
        label: "Email",
        href: "mailto:",
        icon: "mail",
      },
    ],
    workDocs: [
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
    ],
  }
}
