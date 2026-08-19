import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Settings toggles. Track is surface-3 off and accent on. Label names the state it turns on.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: (args) => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Switch aria-label="Notify before deadlines" {...args} />
      Notify before deadlines
    </label>
  ),
};

export const On: Story = {
  render: () => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Switch defaultChecked aria-label="Notify before deadlines" />
      Notify before deadlines
    </label>
  ),
};

export const Disabled: Story = {
  render: () => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Switch disabled aria-label="Notify before deadlines" />
      Notify before deadlines
    </label>
  ),
};
