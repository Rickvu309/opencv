import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProfileView, type ProfileViewData } from "./profile-view";

const meta: Meta<typeof ProfileView> = {
  title: "Screens/Profile",
  component: ProfileView,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ProfileView>;

const filled: ProfileViewData = {
  completeness: 42,
  name: "Nguyễn Thị Ngọc Ánh",
  targetRole: "Analyst",
  education: { school: "NEU", major: "Finance" },
  experience: [{ id: "1", role: "Intern", org: "Grab" }],
};

const idle = {
  name: filled.name,
  onName: () => undefined,
  targetRole: filled.targetRole,
  onTargetRole: () => undefined,
  onSaveIdentity: () => undefined,
  onAddExperience: () => undefined,
};

export const Filled: Story = {
  args: { data: filled, ...idle },
};

export const FirstRun: Story = {
  args: {
    data: {
      completeness: 0,
      name: "",
      targetRole: "",
      education: { school: "", major: "" },
      experience: [],
    },
    empty: true,
    ...idle,
    name: "",
    targetRole: "",
  },
};

export const Loading: Story = {
  args: { pending: true, ...idle, name: "", targetRole: "" },
};

export const Error: Story = {
  args: { error: true, onRetry: () => undefined, ...idle, name: "", targetRole: "" },
};
