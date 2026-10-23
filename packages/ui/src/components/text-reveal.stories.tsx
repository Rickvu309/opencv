import type { Meta, StoryObj } from "@storybook/react-vite"

import { TextReveal } from "./text-reveal"

const meta = {
  title: "Primitives/Text reveal",
  component: TextReveal,
  tags: ["autodocs"],
} satisfies Meta<typeof TextReveal>

export default meta
type Story = StoryObj<typeof meta>

export const ByWord: Story = {
  args: { text: "Your career, started. Free today.", by: "word" },
  render: (args) => <TextReveal {...args} className="text-2xl font-medium" />,
}
