import type { Meta, StoryObj } from "@storybook/react-vite";
import { PersonalPageView, ProofPageView } from "./public-pages";

const meta: Meta = {
  title: "Screens/Share",
  parameters: { layout: "fullscreen" },
};
export default meta;

type PersonalStory = StoryObj<typeof PersonalPageView>;
type ProofStory = StoryObj<typeof ProofPageView>;

export const Personal: PersonalStory = {
  render: () => (
    <PersonalPageView
      data={{
        name: "Nguyễn Thị Ngọc Ánh",
        handle: "an",
        summary: "Analyst intern. Finance at NEU.",
        proofs: [
          {
            slug: "shift-lead",
            title: "Shift lead, weekend batch",
            role: "Intern",
            date_from: "2025",
            date_to: "2026",
          },
        ],
      }}
    />
  ),
};

export const PersonalEmpty: PersonalStory = {
  render: () => (
    <PersonalPageView
      data={{
        name: "Nguyễn Thị Ngọc Ánh",
        handle: "an",
        summary: "Analyst intern. Finance at NEU.",
        proofs: [],
      }}
    />
  ),
};

export const PersonalMissing: PersonalStory = {
  render: () => <PersonalPageView missing />,
};

export const Proof: ProofStory = {
  render: () => (
    <ProofPageView
      href="/p/saturday-close"
      content={{
        words: "Saturday close. We ran out of oat milk and I stayed until the last table left.",
        date: "2026-08-15",
      }}
    />
  ),
};

export const ProofPartial: ProofStory = {
  render: () => (
    <ProofPageView
      href="/p/saturday-close"
      content={{
        words: "Saturday close. We ran out of oat milk and I stayed until the last table left.",
        date: "2026-08-15",
        what: "a Saturday close",
        did: "I stayed until the last table left",
      }}
    />
  ),
};

export const ProofMissing: ProofStory = {
  render: () => <ProofPageView missing />,
};
