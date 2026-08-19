import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./chip";
import { StoryRow } from "./gallery/frame";

const meta: Meta<typeof Chip> = {
  title: "Components/Chip",
  component: Chip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Status on rows. Never a colour without the word. Quiet is hairline. Status is a dot plus the word. Code is mono 12px.",
      },
    },
  },
  args: { children: "Quiet" },
  argTypes: {
    tone: { control: "select", options: ["quiet", "status", "code"] },
    status: {
      control: "select",
      options: ["progress", "positive", "attention", "muted"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {};

export const StatusGrid: Story = {
  render: () => (
    <StoryRow>
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
      <Chip tone="status" status="muted">
        Quiet
      </Chip>
      <Chip tone="code">noun.verb</Chip>
    </StoryRow>
  ),
};
