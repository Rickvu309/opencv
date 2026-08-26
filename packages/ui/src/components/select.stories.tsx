import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select"

const meta = {
  title: "Primitives/Select",
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select defaultValue="inbox">
      <SelectTrigger>
        <SelectValue placeholder="Stage" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Stage</SelectLabel>
          <SelectItem value="inbox">Inbox</SelectItem>
          <SelectItem value="prep">Prep</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="live">Live</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}
