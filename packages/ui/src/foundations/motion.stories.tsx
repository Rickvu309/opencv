import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Motion",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const durations = [
  { name: "fast", ms: "100ms" },
  { name: "base", ms: "150ms" },
  { name: "slow", ms: "200ms" },
] as const

const easings = [
  { name: "standard", value: "cubic-bezier(0.2, 0, 0, 1)" },
  { name: "emphasized", value: "cubic-bezier(0.16, 1, 0.3, 1)" },
] as const

const shadows = ["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"] as const

const zSteps = [
  "base",
  "raised",
  "dropdown",
  "sticky",
  "overlay",
  "modal",
  "popover",
  "toast",
  "max",
] as const

export const DurationsAndEasing: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-2">
        <h1 className="font-heading text-page-title">Motion</h1>
        <p className="text-body text-muted-foreground">
          Durations 100 / 150 / 200, named easings, and a global{" "}
          <code className="text-label">prefers-reduced-motion</code> cutoff.
          The single press affordance is{" "}
          <code className="text-label">active:translate-y-px</code>.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-section-title">Durations</h2>
        <div className="grid gap-3">
          {durations.map((item) => (
            <div key={item.name} className="flex items-center gap-4">
              <div
                className="h-3 w-32 rounded-full bg-foreground"
                style={{
                  animation: `pulse ${item.ms} ease-standard infinite`,
                }}
              />
              <code className="text-micro text-muted-foreground">
                --duration-{item.name} · {item.ms}
              </code>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-section-title">Easings</h2>
        {easings.map((item) => (
          <p key={item.name} className="text-label">
            <code>--ease-{item.name}</code>{" "}
            <span className="text-muted-foreground">{item.value}</span>
          </p>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="text-section-title">Press</h2>
        <button
          type="button"
          className="w-fit rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-transform duration-100 ease-standard active:translate-y-px"
        >
          Press me
        </button>
      </section>
    </div>
  ),
}

export const ShadowAndZ: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-3">
        <h2 className="text-section-title">Shadow scale</h2>
        <div className="flex flex-wrap gap-6 bg-muted/40 p-6">
          {shadows.map((name) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div className={`size-16 rounded-lg bg-card ${name}`} />
              <code className="text-micro text-muted-foreground">{name}</code>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-section-title">Z-index scale</h2>
        <ul className="grid gap-1 text-label">
          {zSteps.map((name) => (
            <li key={name}>
              <code>--z-index-{name}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  ),
}
