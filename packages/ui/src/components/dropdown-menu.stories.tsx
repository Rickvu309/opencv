import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"

const meta = {
  title: "Primitives/Dropdown Menu",
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Upload a file</DropdownMenuItem>
        <DropdownMenuItem>Recent</DropdownMenuItem>
        <DropdownMenuItem>Attach from Paper</DropdownMenuItem>
        <DropdownMenuItem>Add connector</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
