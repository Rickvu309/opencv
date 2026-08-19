import type { Meta, StoryObj } from "@storybook/react-vite";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Foundations/Space",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

const steps = [4, 8, 12, 16, 24, 32, 48];

const radii: [string, string, string][] = [
  ["--radius-tag", "4px", "Tiny chips"],
  ["--radius-control", "6px", "Buttons, inputs, menu items"],
  ["--radius-container", "12px", "Cards, dialogs, the content panel"],
  ["--radius-pill", "9999px", "Status chips"],
];

export const Scale: Story = {
  render: () => (
    <GalleryPage
      title="Space"
      note="4px base. No values off 4, 8, 12, 16, 24, 32, 48. Group gaps are at least twice the gap inside a group."
    >
      <GallerySection title="Scale">
        <div className="flex flex-wrap items-end gap-4">
          {steps.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-ink" style={{ width: n, height: n }} aria-hidden="true" />
              <span className="font-mono text-[12px] text-ink-muted">{n}</span>
            </div>
          ))}
        </div>
      </GallerySection>
      <GallerySection title="Radius">
        <div className="flex flex-wrap gap-4">
          {radii.map(([token, value, role]) => (
            <div key={token} className="w-36">
              <div
                className="h-16 border border-hairline bg-surface-2"
                style={{ borderRadius: `var(${token})` }}
                aria-hidden="true"
              />
              <p className="mt-2 font-mono text-[12px]">{token}</p>
              <p className="text-[13px] text-ink-muted">
                {value} · {role}
              </p>
            </div>
          ))}
        </div>
      </GallerySection>
      <GallerySection title="Elevation">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-4">
            <p className="text-[13px] font-[510]">Hairline</p>
            <p className="mt-1 text-[13px] text-ink-muted">Cards, inputs, panels. No shadow.</p>
          </div>
          <div className="rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-4 shadow-[var(--shadow-overlay)]">
            <p className="text-[13px] font-[510]">Overlay</p>
            <p className="mt-1 text-[13px] text-ink-muted">Menus, dialogs, the dock. The one shadow.</p>
          </div>
        </div>
      </GallerySection>
      <GallerySection title="Touch">
        <div className="flex items-center gap-3">
          <div
            className="flex size-[var(--size-touch)] items-center justify-center rounded-[var(--radius-control)] bg-surface-3 text-[12px] font-mono"
            aria-hidden="true"
          >
            44
          </div>
          <p className="text-[13px] text-ink-muted">
            --size-touch. 40px is acceptable on desktop-only controls. Hit areas never overlap.
          </p>
        </div>
      </GallerySection>
    </GalleryPage>
  ),
};
