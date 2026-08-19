import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyButton } from "./copy-button";

const meta: Meta<typeof CopyButton> = {
  title: "Components/CopyButton",
  component: CopyButton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Ghost copy control. aria-label Copy, swaps to Copied for 1200ms via role=status.",
      },
    },
  },
  args: { value: "noun.verb" },
};

export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {};
