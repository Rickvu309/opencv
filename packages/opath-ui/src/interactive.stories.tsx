import type { Meta, StoryObj } from "@storybook/react-vite";
import { Interactive } from "./interactive";
import { StoryRow } from "./gallery/frame";

const meta: Meta<typeof Interactive> = {
  title: "Core/Interactive",
  component: Interactive,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared hover, selected, disabled, and focus matrix for list-like picks. Selected is surface-3 plus weight 590. Rail items do not sit on Interactive.",
      },
    },
  },
  args: { children: "Row" },
};

export default meta;
type Story = StoryObj<typeof Interactive>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <div className="flex w-[16rem] flex-col gap-1">
      <Interactive>Empty</Interactive>
      <Interactive state="selected">Selected</Interactive>
      <Interactive disabled>Disabled</Interactive>
    </div>
  ),
};

export const AsChild: Story = {
  render: () => (
    <StoryRow>
      <Interactive asChild>
        <a href="#row">As a link</a>
      </Interactive>
    </StoryRow>
  ),
};
