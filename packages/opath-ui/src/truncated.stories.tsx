import type { Meta, StoryObj } from "@storybook/react-vite";
import { Truncated } from "./truncated";

const meta: Meta<typeof Truncated> = {
  title: "Components/Truncated",
  component: Truncated,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "One-line ellipsis with title for the full value. History thread titles use this.",
      },
    },
  },
  args: { children: "Nguyễn Thị Ngọc Ánh — a long row label that must not clip the tone marks" },
};

export default meta;
type Story = StoryObj<typeof Truncated>;

export const Default: Story = {
  render: (args) => (
    <div className="w-40">
      <Truncated {...args} />
    </div>
  ),
};
