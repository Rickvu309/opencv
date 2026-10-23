import type { Meta, StoryObj } from "@storybook/react-vite"

import { Section } from "./section"

const meta = {
  title: "Primitives/Section",
  component: Section,
  tags: ["autodocs"],
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Section aria-label="Example">
      <h2 className="text-3xl font-medium tracking-tight">Coach</h2>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Content sits in a 1344 px column with 128 px of vertical rhythm on
        desktop.
      </p>
    </Section>
  ),
}
