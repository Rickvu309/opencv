import type { Meta, StoryObj } from "@storybook/react-vite";
import { emptyCv } from "@/features/paper/model";
import { PaperPage } from "@/features/paper/components/page";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

const meta: Meta = {
  title: "Screens/Paper/Page",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Café-shift line only",
  render: () => (
    <div className="bg-desk px-5 py-8">
      <PaperPage
        kind="cv"
        content={emptyCv()}
        publishedLines={[
          {
            date: "2026-08-20",
            words: SATURDAY_CLOSE,
          },
        ]}
        onChange={() => undefined}
        onCommit={() => undefined}
      />
    </div>
  ),
};

export const TypedRows: Story = {
  render: () => {
    const content = emptyCv();
    content.name = "Linh";
    content.contact = "Da Nang";
    content.experience = [
      { id: "e1", org: "Cafe", role: "Barista", dates: "2025", bullets: [SATURDAY_CLOSE] },
    ];
    return (
      <div className="bg-desk px-5 py-8">
        <PaperPage
          kind="cv"
          content={content}
          publishedLines={[{ date: "2026-08-20", words: SATURDAY_CLOSE }]}
          onChange={() => undefined}
          onCommit={() => undefined}
        />
      </div>
    );
  },
};
