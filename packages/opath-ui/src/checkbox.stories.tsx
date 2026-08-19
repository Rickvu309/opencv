import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "44px hit area via the wrapping label. Checked fill is accent. Invalid uses aria-invalid.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Checkbox aria-label="Done" {...args} />
      Done
    </label>
  ),
};

export const Checked: Story = {
  render: () => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Checkbox defaultChecked aria-label="Done" />
      Done
    </label>
  ),
};

export const Disabled: Story = {
  render: () => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Checkbox disabled aria-label="Done" />
      Done
    </label>
  ),
};

export const Invalid: Story = {
  render: () => (
    <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
      <Checkbox aria-invalid aria-label="Done" />
      Done
    </label>
  ),
};
