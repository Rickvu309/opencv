import type { Meta, StoryObj } from "@storybook/react-vite";
import { OnboardingWizard, type OnboardingValues } from "./onboarding-wizard";

const meta: Meta<typeof OnboardingWizard> = {
  title: "Screens/Onboarding",
  component: OnboardingWizard,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof OnboardingWizard>;

const base: OnboardingValues = {
  step: 0,
  targetRole: "",
  unsure: false,
  school: "",
  major: "",
  year: "",
  org: "",
  role: "",
  linkKind: "",
  linkUrl: "",
  pending: false,
  saveError: null,
};

const idle = {
  onChange: () => undefined,
  onContinue: () => undefined,
  onSkip: () => undefined,
  onFinish: () => undefined,
};

export const Goal: Story = {
  args: { values: base, ...idle },
};

export const GoalFilled: Story = {
  args: { values: { ...base, targetRole: "Analyst" }, ...idle },
};

export const School: Story = {
  args: {
    values: { ...base, step: 1, targetRole: "Analyst", school: "NEU" },
    ...idle,
  },
};

export const Work: Story = {
  args: {
    values: {
      ...base,
      step: 2,
      targetRole: "Analyst",
      school: "NEU",
      major: "Finance",
      year: "2026",
      org: "Grab",
      role: "Intern",
    },
    ...idle,
  },
};

export const Coach: Story = {
  args: {
    values: {
      ...base,
      step: 3,
      targetRole: "Analyst",
      school: "NEU",
      org: "Grab",
      role: "Intern",
    },
    ...idle,
  },
};

export const SaveError: Story = {
  args: {
    values: { ...base, step: 3, saveError: "Couldn't save. Try again." },
    ...idle,
  },
};
