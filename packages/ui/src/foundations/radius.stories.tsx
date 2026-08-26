import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Radius",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const steps = [
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-xl",
  "radius-2xl",
  "radius-3xl",
  "radius-4xl",
] as const

export const Scale: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-page-title">Radius</h1>
        <p className="text-body text-muted-foreground">
          One primitive (<code className="text-label">--radius</code> = 0.625rem)
          and seven computed steps.
        </p>
      </section>
      <div className="flex flex-wrap items-end gap-4">
        {steps.map((step) => (
          <div key={step} className="flex flex-col items-center gap-2">
            <div
              className="size-16 border border-border bg-muted"
              style={{ borderRadius: `var(--${step})` }}
            />
            <code className="text-micro text-muted-foreground">--{step}</code>
          </div>
        ))}
      </div>
    </div>
  ),
}
