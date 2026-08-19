import type { Meta, StoryObj } from "@storybook/react-vite";
import { Keycap } from "./keycap";
import { StoryRow } from "./gallery/frame";

const meta: Meta<typeof Keycap> = {
  title: "Components/Keycap",
  component: Keycap,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Mono 12px key. Used in composer hints.",
      },
    },
  },
  args: { children: "Enter" },
};

export default meta;
type Story = StoryObj<typeof Keycap>;

export const Default: Story = {};

export const Pair: Story = {
  render: () => (
    <StoryRow>
      <Keycap>Enter</Keycap>
      <Keycap>Esc</Keycap>
    </StoryRow>
  ),
};
