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

const msg = (vi: string, en: string): Msg => ({ vi, en });

export const vaultItems: VaultItem[] = [
  {
    id: "cv",
    title: msg("CV", "CV"),
    weight: 18,
    benefit: msg(
      "Hồ sơ chính của bạn. Dựng được ngay tại đây.",
      "Your main document. You can build one here.",
    ),
    addLabel: msg("Thêm CV", "Add a CV"),
    coachPrompt: msg(
      "Review giúp mình CV hiện tại",
      "Review my current CV",
    ),
  },
  {
    id: "portfolio",
    title: msg("Portfolio dự án", "Portfolio"),
    weight: 12,
    benefit: msg(
      "Bằng chứng mạnh nhất khi bạn chưa nhiều kinh nghiệm. Một dự án là đủ.",
      "Your strongest evidence before a long CV. One finished project is enough.",
    ),
    addLabel: msg("Thêm dự án", "Add a project"),
    coachPrompt: msg(
      "Góp ý cách kể chuyện dự án trong portfolio",
      "How should I write up my portfolio projects?",
    ),
  },
  {
    id: "cover-letter",
    title: msg("Thư ứng tuyển", "Cover letter"),
    weight: 10,
    benefit: msg(
      "Coach viết bản nháp từ CV và mục tiêu của bạn.",
      "The Coach drafts one from your CV and your goal.",
    ),
    addLabel: msg("Nhờ Coach viết", "Ask the Coach to draft"),
    coachPrompt: msg(
      "Viết giúp mình bản nháp thư ứng tuyển",
      "Draft a cover letter for me",
    ),
  },
  {
    id: "linkedin",
    title: msg("LinkedIn", "LinkedIn"),
    weight: 8,
    benefit: msg(
      "Để Coach đối chiếu hồ sơ với tin tuyển dụng thật.",
      "Lets the Coach check your profile against real job ads.",
    ),
    addLabel: msg("Liên kết", "Add the link"),
    coachPrompt: msg(
      "Xem giúp mình trang LinkedIn nên sửa gì",
      "What should I change on my LinkedIn?",
    ),
  },
  {
    id: "github",
    title: msg("GitHub", "GitHub"),
    weight: 6,
    benefit: msg(
      "Nơi lưu code dự án. Nhà tuyển dụng kỹ tính sẽ tìm nó.",
      "Where your project code lives. Technical reviewers look for it.",
    ),
    addLabel: msg("Liên kết", "Add the link"),
    coachPrompt: msg(
      "Repo của mình nên trình bày thế nào?",
      "How should I present my repos?",
    ),
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

