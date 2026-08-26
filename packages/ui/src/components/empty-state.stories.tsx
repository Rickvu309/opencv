import type { Meta, StoryObj } from "@storybook/react-vite"
import { InboxIcon } from "lucide-react"

import { Button } from "./button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty-state"

const meta = {
  title: "Primitives/Empty State",
  component: Empty,
  tags: ["autodocs"],
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No Opportunities yet</EmptyTitle>
        <EmptyDescription>
          Save a job or internship to start tracking it in Apply.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Add Opportunity</Button>
      </EmptyContent>
    </Empty>
  ),
}
