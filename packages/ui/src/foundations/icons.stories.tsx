import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InboxIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react"

const meta = {
  title: "Foundations/Icons",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const icons = [
  { name: "Check", Icon: CheckIcon },
  { name: "ChevronDown", Icon: ChevronDownIcon },
  { name: "ChevronRight", Icon: ChevronRightIcon },
  { name: "Inbox", Icon: InboxIcon },
  { name: "Loader2", Icon: Loader2Icon },
  { name: "Search", Icon: SearchIcon },
  { name: "X", Icon: XIcon },
] as const

export const Lucide: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-page-title">Icons</h1>
        <p className="text-body text-muted-foreground">
          Lucide is the kit icon library. Components size icons; do not add{" "}
          <code className="text-label">size-*</code> on icons inside kit
          primitives.
        </p>
      </section>
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-7">
        {icons.map(({ name, Icon }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-4" />
            </div>
            <code className="text-micro text-muted-foreground">{name}</code>
          </div>
        ))}
      </div>
    </div>
  ),
}
