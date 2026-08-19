import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "../chip";

const meta: Meta<typeof Chip> = {
  title: "Components/Chip",
  component: Chip,
};
export default meta;

type Story = StoryObj<typeof Chip>;

export const Quiet: Story = { args: { children: "Quiet" } };
export const Progress: Story = {
  args: { tone: "status", status: "progress", children: "In progress" },
};
export const Positive: Story = {
  args: { tone: "status", status: "positive", children: "Done" },
};
export const Attention: Story = {
  args: { tone: "status", status: "attention", children: "Needs action" },
};
export const Code: Story = { args: { tone: "code", children: "noun.verb" } };

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip>Quiet</Chip>
      <Chip tone="status" status="progress">
        In progress
      </Chip>
      <Chip tone="status" status="positive">
        Done
      </Chip>
      <Chip tone="status" status="attention">
        Needs action
      </Chip>
      <Chip tone="code">noun.verb</Chip>
    </div>
  ),
};
