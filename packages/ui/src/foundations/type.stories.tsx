import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Type",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const roles = [
  {
    role: "page-title",
    className: "font-heading text-page-title",
    sample: "Good morning.",
    spec: "1.875rem / heading serif",
  },
  {
    role: "section-title",
    className: "text-section-title font-medium",
    sample: "Recent Threads",
    spec: "1.25rem",
  },
  {
    role: "body",
    className: "text-body",
    sample: "The Coach can take the same actions you can.",
    spec: "0.875rem",
  },
  {
    role: "label",
    className: "text-label font-medium",
    sample: "Opportunity",
    spec: "0.75rem",
  },
  {
    role: "micro",
    className: "text-micro",
    sample: "Inbox · Prep · Sent",
    spec: "0.6875rem (11px)",
  },
] as const

const microTier = [
  { name: "text-3xs", className: "text-3xs", spec: "9px" },
  { name: "text-2xs", className: "text-2xs", spec: "10px" },
  { name: "text-micro", className: "text-micro", spec: "11px" },
] as const

export const Roles: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-8">
      <section className="grid gap-2">
        <h1 className="font-heading text-page-title">Type</h1>
        <p className="text-body text-muted-foreground">
          Documented roles map to the scale. Display voice is{" "}
          <code className="text-label">--font-heading</code> — the serif stack
          previously inlined on Home and auth.
        </p>
      </section>
      <section className="grid gap-5">
        {roles.map((item) => (
          <div key={item.role} className="grid gap-1 border-b border-border pb-4">
            <p className={item.className}>{item.sample}</p>
            <p className="text-micro text-muted-foreground">
              {item.role} · {item.spec}
            </p>
          </div>
        ))}
      </section>
    </div>
  ),
}

export const MicroLabelTier: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <h2 className="text-section-title">Micro-label tier</h2>
      {microTier.map((item) => (
        <div key={item.name} className="flex items-baseline justify-between">
          <span className={item.className}>Saved 2 hours ago</span>
          <code className="text-micro text-muted-foreground">
            {item.name} · {item.spec}
          </code>
        </div>
      ))}
    </div>
  ),
}

export const HeadingStack: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <h2 className="text-section-title">Heading stack</h2>
      <p className="font-heading text-page-title">OpenCV</p>
      <code className="text-micro text-muted-foreground">
        ui-serif, Georgia, Cambria, Times New Roman, Times, serif
      </code>
    </div>
  ),
}
