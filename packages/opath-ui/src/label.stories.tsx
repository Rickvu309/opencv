import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
  title: "Components/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Visible label. ui-label 13/510. Every input has a real label; placeholder is not one.",
      },
    },
  },
  args: { children: "Email", htmlFor: "label-demo" },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};
