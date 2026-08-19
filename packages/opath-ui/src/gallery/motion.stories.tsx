import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Foundations/Motion",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Tokens: Story = {
  render: () => (
    <GalleryPage
      title="Motion"
      note="Calm is the requirement. Transform and opacity only. ease-in never appears. Press a control — it scales to 0.97."
    >
      <GallerySection title="Durations">
        <ul className="space-y-2 text-[15px] leading-[1.6]">
          <li>
            <span className="font-mono text-[13px]">--duration-fast</span> 120ms — press, hover,
            crossfade
          </li>
          <li>
            <span className="font-mono text-[13px]">--duration-base</span> 200ms — drawer, dialog,
            sheet
          </li>
          <li>
            <span className="font-mono text-[13px]">--ease-out</span> cubic-bezier(0.23, 1, 0.32, 1)
          </li>
          <li>
            <span className="font-mono text-[13px]">--ease-drawer</span> cubic-bezier(0.32, 0.72, 0,
            1)
          </li>
        </ul>
      </GallerySection>
      <GallerySection title="Press">
        <Button>Press me</Button>
      </GallerySection>
      <GallerySection title="Never">
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-[1.5] text-ink-muted">
          <li>Thread switching and other 100-times-a-day clicks</li>
          <li>Filter pills and tab toggles</li>
          <li>Route changes, counting numbers, confetti, bounce</li>
        </ul>
      </GallerySection>
    </GalleryPage>
  ),
};
