import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "For icon-only controls that need a word. Delay 200ms. Never the only explanation for a disabled control.",
      },
    },
  },
  args: { tooltip: "A short explanation" },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" type="button" aria-label="A short explanation">
        Tip
      </Button>
    </Tooltip>
  ),
};
