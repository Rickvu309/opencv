import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsView, type SettingsViewData } from "./settings-view";

const meta: Meta<typeof SettingsView> = {
  title: "Settings/Screen",
  component: SettingsView,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof SettingsView>;

const data: SettingsViewData = {
  email: "you@school.edu",
  handle: "an",
  prefs: { deadline: true, idle: true },
};

const idle = {
  email: "",
  onEmail: () => undefined,
  emailPassword: "",
  onEmailPassword: () => undefined,
  onChangeEmail: () => undefined,
  currentPassword: "",
  onCurrentPassword: () => undefined,
  nextPassword: "",
  onNextPassword: () => undefined,
  onChangePassword: () => undefined,
  onSignOut: () => undefined,
  handle: "an",
  onHandle: () => undefined,
  onSaveHandle: () => undefined,
  deadline: true,
  onDeadline: () => undefined,
  idle: true,
  onIdle: () => undefined,
  onSavePrefs: () => undefined,
  confirmDelete: false,
  onConfirmDelete: () => undefined,
  onDelete: () => undefined,
};

export const Default: Story = {
  args: { data, ...idle },
};

export const DeleteConfirm: Story = {
  args: { data, ...idle, confirmDelete: true },
};

export const Loading: Story = {
  args: { pending: true, ...idle, handle: "" },
};

export const Error: Story = {
  args: { error: true, onRetry: () => undefined, ...idle, handle: "" },
};
