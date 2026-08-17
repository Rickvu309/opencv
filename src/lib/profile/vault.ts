// Vault kinds the profile can hold, and what each is worth. Not anyone's data.
//
// Filled means the Coach can read it. Weights are the remaining 40 of the
// profile completeness score; `profileWeights` covers identity-adjacent facts.
// CV and cover-letter files live in My Paper, not here.

import type { Msg } from "@/lib/i18n/locale";

export type VaultItemId = "linkedin" | "portfolio" | "github";

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
    id: "portfolio",
    title: msg("Portfolio"),
    weight: 18,
    benefit: msg("Your strongest evidence before a long CV. One finished project is enough."),
    addLabel: msg("Add a project"),
    coachPrompt: msg("How should I write up my portfolio projects?"),
  },
  {
    id: "linkedin",
    title: msg("LinkedIn"),
    weight: 12,
    benefit: msg("Lets the Coach check your profile against real job ads."),
    addLabel: msg("Add the link"),
    coachPrompt: msg("What should I change on my LinkedIn?"),
  },
  {
    id: "github",
    title: msg("GitHub"),
    weight: 10,
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
 * carries. The vault weights above account for the remaining 40.
 */
export const profileWeights = {
  context: 18,
  experience: 22,
  education: 12,
  courses: 8,
} as const;
