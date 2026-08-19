import type { Meta, StoryObj } from "@storybook/react-vite";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Foundations/Overview",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const ReadMe: Story = {
  render: () => (
    <GalleryPage
      title="Opath (Production)"
      note="This gallery is the design system. Lab is a sourced catalog on the other Storybook."
    >
      <GallerySection title="Chapters">
        <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-[1.6]">
          <li>
            <span className="font-[510]">Foundations</span> — tokens as they live in{" "}
            <span className="font-mono text-[13px]">globals.css</span>. Swatches read the CSS
            variables; they do not hardcode hex.
          </li>
          <li>
            <span className="font-[510]">Components</span> — one entry per primitive. Named
            stories are states (rest, invalid, disabled, loading), not a junk drawer.
          </li>
          <li>
            <span className="font-[510]">Patterns</span> — two or more components in the layout
            they occupy: a band over rows, a section over fields.
          </li>
          <li>
            <span className="font-[510]">Screens</span> — product views assembled from the
            chapters above. Screens compose primitives; they do not restyle them.
          </li>
        </ol>
      </GallerySection>
      <GallerySection title="House rules">
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-[1.6]">
          <li>Semantic tokens only. Never a raw hex in a component.</li>
          <li>
            Accent is black and only means interactive: the primary action, links, focus, active
            toggles.
          </li>
          <li>
            Status hues live inside chips and dots, always beside the word. Never as text or a
            fill.
          </li>
          <li>
            Weights are 400, 510, and 590. Type specimens include Vietnamese diacritics.
          </li>
          <li>
            <code className="font-mono text-[13px]">:focus-visible</code> shows{" "}
            <code className="font-mono text-[13px]">--focus-ring</code>. Outline none never ships
            without a replacement.
          </li>
        </ul>
      </GallerySection>
    </GalleryPage>
  ),
};
