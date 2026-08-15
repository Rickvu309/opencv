// The app's fixed vocabulary: the kinds of thing OpenPath knows about, and what
// each is worth. Not anyone's data.
//
// This replaces `lib/data.ts`, which mixed three unrelated things: a seeded
// demo persona, this catalog, and the shared types. Screens read the catalog
// and the store; nobody reads a person who is not the one signed in.

import type { Msg } from "@/lib/i18n/locale";

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
};

export type VaultItemId =
  | "cv"
  | "cover-letter"
  | "linkedin"
  | "portfolio"
  | "github";

/** A document kind the profile can hold. Filled means the Coach can read it. */
export type VaultItem = {
  id: VaultItemId;
  title: Msg;
  /** Contribution to the profile completeness score. */
  weight: number;
  /** Why it is worth adding, shown while the kind is empty. An invitation,
   *  never a guilt-trip: it says what you gain, not what you are missing. */
  benefit: Msg;
  addLabel: Msg;
  /** Handed to the Coach when the user asks for a look at this kind. */
  coachPrompt: Msg;
};

const msg = (en: string): Msg => en;

export const vaultItems: VaultItem[] = [
  {
    id: "cv",
    title: msg("CV"),
    weight: 18,
    benefit: msg("Your main document. You can build one here."),
    addLabel: msg("Add a CV"),
    coachPrompt: msg("Review my current CV"),
  },
  {
    id: "portfolio",
    title: msg("Portfolio"),
    weight: 12,
    benefit: msg("Your strongest evidence before a long CV. One finished project is enough."),
    addLabel: msg("Add a project"),
    coachPrompt: msg("How should I write up my portfolio projects?"),
  },
  {
    id: "cover-letter",
    title: msg("Cover letter"),
    weight: 10,
    benefit: msg("The Coach drafts one from your CV and your goal."),
    addLabel: msg("Ask the Coach to draft"),
    coachPrompt: msg("Draft a cover letter for me"),
  },
  {
    id: "linkedin",
    title: msg("LinkedIn"),
    weight: 8,
    benefit: msg("Lets the Coach check your profile against real job ads."),
    addLabel: msg("Add the link"),
    coachPrompt: msg("What should I change on my LinkedIn?"),
  },
  {
    id: "github",
    title: msg("GitHub"),
    weight: 6,
    benefit: msg("Where your project code lives. Technical reviewers look for it."),
    addLabel: msg("Add the link"),
    coachPrompt: msg("How should I present my repos?"),
  },
];

/**
 * What each filled part of the profile is worth, out of 100 with the vault.
 *
 * Every point is earned. There is no base score: a profile that has been filled
 * in is the only thing that scores, which is the whole signal the number
 * carries. The vault weights above account for the remaining 54.
 */
export const profileWeights = {
  context: 14,
  experience: 14,
  education: 10,
  courses: 8,
} as const;

