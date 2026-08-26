import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
  title: "Foundations/Color",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const semantic = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["destructive", "background"],
  ["success", "success-foreground"],
  ["warning", "warning-foreground"],
  ["info", "info-foreground"],
] as const

const charts = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const
const tones = ["warm", "cool", "neutral", "emerald", "dark"] as const
const heatmap = [0, 1, 2, 3, 4] as const

function Swatch({
  name,
  fg,
}: {
  name: string
  fg?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-16 items-end rounded-lg border border-border p-2 text-xs"
        style={{
          background: `var(--${name})`,
          color: fg ? `var(--${fg})` : "var(--foreground)",
        }}
      >
        {fg ? "Aa" : ""}
      </div>
      <code className="text-micro text-muted-foreground">--{name}</code>
    </div>
  )
}

export const Semantic: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-3">
        <h1 className="font-heading text-page-title">Color</h1>
        <p className="text-body text-muted-foreground">
          Monochrome identity plus status hues. Raw hex stays out of app code
          except CV print paper and the GitHub heatmap tokens.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-section-title">Semantic</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {semantic.map(([bg, fg]) => (
            <Swatch key={bg} name={bg} fg={fg} />
          ))}
        </div>
      </section>
    </div>
  ),
}

export const StatusAndChart: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-3">
        <h2 className="text-section-title">Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <Swatch name="success" fg="success-foreground" />
          <Swatch name="warning" fg="warning-foreground" />
          <Swatch name="info" fg="info-foreground" />
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-section-title">Chart ramp</h2>
        <p className="text-label text-muted-foreground">
          Differentiated hues so Apply stage dots communicate.
        </p>
        <div className="grid grid-cols-5 gap-3">
          {charts.map((name) => (
            <Swatch key={name} name={name} />
          ))}
        </div>
      </section>
    </div>
  ),
}

export const PitchTones: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      <h2 className="text-section-title">Pitch tone table</h2>
      <p className="text-label text-muted-foreground">
        Token-backed gradients. Feature adoption is DS-2.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {tones.map((tone) => (
          <div key={tone} className="flex flex-col gap-2">
            <div
              className="h-20 rounded-lg border border-border"
              style={{ background: `var(--pitch-tone-${tone})` }}
            />
            <code className="text-micro text-muted-foreground">
              --pitch-tone-{tone}
            </code>
          </div>
        ))}
      </div>
    </div>
  ),
}

export const GithubHeatmap: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      <h2 className="text-section-title">GitHub heatmap</h2>
      <p className="text-label text-muted-foreground">
        Documented hex exception, tokenized as its own ramp.
      </p>
      <div className="flex gap-2">
        {heatmap.map((level) => (
          <div key={level} className="flex flex-col items-center gap-2">
            <div
              className="size-8 rounded-sm"
              style={{ background: `var(--github-heatmap-${level})` }}
            />
            <code className="text-micro text-muted-foreground">{level}</code>
          </div>
        ))}
      </div>
    </div>
  ),
}
