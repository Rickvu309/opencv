import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "../chip";
import { ColorSwatch, GalleryPage, GallerySection, TokenRow } from "./frame";

const meta: Meta = {
  title: "Foundations/Color",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

const surfaces: [string, string][] = [
  ["--canvas", "App shell behind the content panel"],
  ["--surface-1", "Panel, cards, inputs, menus"],
  ["--surface-2", "Hover fill, group headers, skeletons"],
  ["--surface-3", "Pressed fill, selected rows"],
  ["--desk", "Page canvas stage — cool gray desk under the A4"],
  ["--hairline", "1px borders"],
];

const ink: [string, string][] = [
  ["--ink", "Headings, row labels, body"],
  ["--ink-secondary", "Supporting copy"],
  ["--ink-muted", "Metadata, captions — last AA step on surface-1"],
  ["--ink-faint", "Placeholders and disabled; never body"],
];

const accent: [string, string][] = [
  ["--accent", "Links, primary action, active toggles"],
  ["--accent-hover", "Hover on accent fills"],
  ["--accent-muted", "Quiet fill behind a selected accent item"],
  ["--on-accent", "Text on accent fills"],
  ["--destructive", "Delete, and nothing else"],
];

export const Ladder: Story = {
  render: () => (
    <GalleryPage
      title="Color"
      note="Swatches read CSS variables. Status hues only appear inside chips, beside the word."
    >
      <GallerySection title="Surfaces">
        {surfaces.map(([token, role]) => (
          <TokenRow key={token} token={token} role={role} swatch={<ColorSwatch token={token} />} />
        ))}
      </GallerySection>
      <GallerySection title="Ink">
        {ink.map(([token, role]) => (
          <TokenRow key={token} token={token} role={role} swatch={<ColorSwatch token={token} />} />
        ))}
      </GallerySection>
      <GallerySection title="Accent">
        {accent.map(([token, role]) => (
          <TokenRow key={token} token={token} role={role} swatch={<ColorSwatch token={token} />} />
        ))}
        <TokenRow
          token="--focus-ring"
          role="Focus state, everywhere, unaltered"
          swatch={
            <button
              type="button"
              className="size-10 rounded-[var(--radius-control)] border border-hairline bg-surface-1 shadow-[var(--focus-ring)]"
              aria-label="Focus ring sample"
            />
          }
        />
      </GallerySection>
      <GallerySection title="Status — chips only">
        <div className="flex flex-wrap gap-2">
          <Chip tone="status" status="progress">
            In progress
          </Chip>
          <Chip tone="status" status="positive">
            Done
          </Chip>
          <Chip tone="status" status="attention">
            Needs action
          </Chip>
          <Chip tone="status" status="muted">
            Quiet
          </Chip>
        </div>
      </GallerySection>
    </GalleryPage>
  ),
};
