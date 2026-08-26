import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "./button"
import { Spinner } from "./spinner"

const meta = {
  title: "Primitives/Spinner",
  component: Spinner,
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner data-icon="inline-start" />
      Saving
    </Button>
  ),
}
