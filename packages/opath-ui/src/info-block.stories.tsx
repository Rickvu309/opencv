import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoBlock } from "./info-block";

const meta: Meta<typeof InfoBlock> = {
  title: "Components/InfoBlock",
  component: InfoBlock,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Quiet callout on surface-2. ui 13px. A next step lives in the sentence.",
      },
    },
  },
  args: { children: "A quiet note with a next step." },
};

export default meta;
type Story = StoryObj<typeof InfoBlock>;

export const Default: Story = {};
