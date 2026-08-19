import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loader } from "./loader";

const meta: Meta<typeof Loader> = {
  title: "Components/Loader",
  component: Loader,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "16px stroke icon. aria-hidden when a word already names the state. Never a spinner-only button.",
      },
    },
  },
  args: { label: "Loading" },
};

export default meta;
type Story = StoryObj<typeof Loader>;

export const Default: Story = {};
