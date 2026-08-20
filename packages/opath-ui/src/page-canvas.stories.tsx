import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageCanvas } from "./page-canvas";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

const meta: Meta<typeof PageCanvas> = {
  title: "Layouts/Page canvas",
  component: PageCanvas,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cool gray desk. One white A4 as an object. Empty is a hairline-dashed sheet on that desk, not a transparent ghost.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageCanvas>;

export const Default: Story = {
  args: {
    empty: true,
    label: "Open a page",
    onOpen: () => undefined,
  },
};

export const Filled: Story = {
  args: {
    label: "Open a page",
    onOpen: () => undefined,
    children: (
      <>
        <p className="text-[13px] text-ink-muted tabular-nums">
          {new Date(2026, 7, 20).toLocaleDateString()}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] font-[510] leading-[1.6]">
          {SATURDAY_CLOSE}
        </p>
      </>
    ),
  },
};
