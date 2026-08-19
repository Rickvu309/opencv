import type { Meta, StoryObj } from "@storybook/react-vite";
import { PersonalPageView, ProofPageView } from "./public-pages";

const meta: Meta = {
  title: "Share/Pages",
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
      content={{
        title: "Shift lead, weekend batch",
        role: "Intern",
        what: "The weekend batch slipped when two people called out.",
        did: "I split the remaining work and wrote a one-page runbook.",
        came: "The batch finished on time the next weekend.",
      }}
    />
  ),
};

export const ProofMissing: ProofStory = {
  render: () => <ProofPageView missing />,
};
