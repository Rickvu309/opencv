import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "./button"
import { ButtonGroup } from "./button-group"

const meta = {
  title: "Primitives/Button Group",
  component: ButtonGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Board</Button>
      <Button variant="outline">Calendar</Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Inbox</Button>
      <Button variant="outline">Prep</Button>
      <Button variant="outline">Sent</Button>
    </ButtonGroup>
  ),
}
