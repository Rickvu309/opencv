import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mark } from "./mark";

const meta: Meta<typeof Mark> = {
  title: "Components/Mark",
  component: Mark,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "The OpenPath mark. Used in the rail header and the Coach dock pill.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Mark>;

export const Default: Story = {};

export const Large: Story = {
  args: { className: "size-8" },
};
