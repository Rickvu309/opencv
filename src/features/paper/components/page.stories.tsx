import type { Meta, StoryObj } from "@storybook/react-vite";
import { emptyCv } from "@/features/paper/model";
import { PaperPage } from "@/features/paper/components/page";

const meta: Meta = {
  title: "Screens/Paper/Page",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="bg-desk px-5 py-8">
      <PaperPage
        kind="cv"
        content={emptyCv()}
        publishedLines={[
          {
            date: "2026-08-20",
            words:
              "Saturday close. We ran out of oat milk and I stayed until the last table left.",
          },
        ]}
        onChange={() => undefined}
        onCommit={() => undefined}
      />
    </div>
  ),
};
