import type { Meta, StoryObj } from "@storybook/react-vite";
import { PitchView } from "./pitch-view";

const meta: Meta<typeof PitchView> = {
  title: "Screens/Pitch",
  component: PitchView,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof PitchView>;

const actions = {
  onBio: () => undefined,
  onSaveBio: () => undefined,
  onDraftBio: () => undefined,
  onIntro: () => undefined,
  onSaveIntro: () => undefined,
  onDraftIntro: () => undefined,
  onPrompt: () => undefined,
  onAnswer: () => undefined,
  onSaveAnswer: () => undefined,
};

export const Empty: Story = {
  args: {
    empty: true,
    data: { bio: "", intro: "", answers: [] },
    bio: "",
    intro: "",
    introNote: "",
    prompt: "",
    answer: "",
    ...actions,
  },
};

export const Filled: Story = {
  args: {
    data: {
      bio: "Analyst intern. Finance at NEU.",
      intro: "I'm aiming for an analyst internship this cycle.",
      answers: [
        {
          id: "1",
          prompt: "Tell me about a time you led something.",
          body: "I ran the weekend batch when two people called out.",
        },
      ],
    },
    bio: "Analyst intern. Finance at NEU.",
    intro: "I'm aiming for an analyst internship this cycle.",
    introNote: "",
    prompt: "",
    answer: "",
    ...actions,
  },
};

export const MissingGoal: Story = {
  args: {
    data: {
      bio: "Analyst intern. Finance at NEU.",
      intro: "",
      answers: [],
    },
    bio: "Analyst intern. Finance at NEU.",
    intro: "",
    introNote: "Set a goal on your profile first.",
    prompt: "",
    answer: "",
    ...actions,
  },
};
