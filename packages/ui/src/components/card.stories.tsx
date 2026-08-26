import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "./button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"

const meta = {
  title: "Primitives/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Inbox</CardTitle>
        <CardDescription>Opportunities waiting to be triaged.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="xs">
            New
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Three cards need a next Track.</CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Open Apply
        </Button>
      </CardFooter>
    </Card>
  ),
}

export const Small: Story = {
  render: () => (
    <Card size="sm" className="w-72">
      <CardHeader>
        <CardTitle>Proof</CardTitle>
        <CardDescription>Context → action → outcome.</CardDescription>
      </CardHeader>
      <CardContent>A short evidence chain.</CardContent>
    </Card>
  ),
}
