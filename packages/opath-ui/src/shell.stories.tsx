import type { Meta, StoryObj } from "@storybook/react-vite";
import { SkipLink } from "./shell";

const meta: Meta<typeof SkipLink> = {
  title: "Layouts/SkipLink",
  component: SkipLink,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "First focusable element on every page. Visually hidden until focused, then a surface-1 chip at the top-left.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SkipLink>;

export const Default: Story = {
  render: () => (
    <div className="relative min-h-16">
      <p className="text-[13px] text-ink-muted">Tab into the canvas to reveal Skip to content.</p>
      <SkipLink />
    </div>
  ),
};
