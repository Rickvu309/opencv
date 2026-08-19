import type { Meta, StoryObj } from "@storybook/react-vite";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Foundations/Type",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

const roles = [
  {
    name: "display",
    sample: "A coach for the first job.",
    className: "text-[clamp(2rem,1.2rem+3vw,4rem)] font-[590] leading-[1.3] tracking-[-0.028em]",
    meta: "32–64px / 590 / −0.028em — landing promise only",
  },
  {
    name: "title-lg",
    sample: "Nguyễn Thị Ngọc Ánh",
    className: "text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]",
    meta: "24px / 590 / −0.017em — one h1 per screen",
  },
  {
    name: "title",
    sample: "trường đại học",
    className: "text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]",
    meta: "18px / 510 / −0.012em — section and dialog titles",
  },
  {
    name: "title-sm",
    sample: "Row label",
    className: "text-[15px] font-[510] leading-[1.5] tracking-[-0.012em]",
    meta: "15px / 510 / −0.012em — row and card labels",
  },
  {
    name: "body",
    sample: "Reading text, messages, editors. Line height 1.6 so tone marks do not clip.",
    className: "text-[15px] font-[400] leading-[1.6]",
    meta: "15px / 400 / 1.6",
  },
  {
    name: "ui",
    sample: "Meta, filters, chips, buttons",
    className: "text-[13px] font-[400] leading-[1.5]",
    meta: "13px / 400",
  },
  {
    name: "ui-label",
    sample: "Form labels",
    className: "text-[13px] font-[510] leading-[1.5]",
    meta: "13px / 510",
  },
  {
    name: "caption",
    sample: "Tertiary detail",
    className: "text-[12px] font-[400] leading-[1.5]",
    meta: "12px / 400",
  },
  {
    name: "mono",
    sample: "paper.create",
    className: "font-mono text-[13px] leading-[1.5]",
    meta: "Code, keys, the public handle",
  },
];

export const Scale: Story = {
  render: () => (
    <GalleryPage
      title="Type"
      note="Inter Variable. Weights 400, 510, 590. Vietnamese names and stacked tone marks must not clip."
    >
      {roles.map((role) => (
        <GallerySection key={role.name} title={role.name}>
          <p className={role.className}>{role.sample}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{role.meta}</p>
        </GallerySection>
      ))}
    </GalleryPage>
  ),
};
