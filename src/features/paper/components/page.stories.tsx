import type { Meta, StoryObj } from "@storybook/react-vite";
import { CoachSessionProvider } from "@/features/coach/components/session";
import { emptyCv } from "@/features/paper/model";
import { PaperPage } from "@/features/paper/components/page";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

const meta: Meta = {
  title: "Screens/Paper/Page",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <CoachSessionProvider>
        <Story />
      </CoachSessionProvider>
    ),
  ],
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

export const LeftoverEmptyCv: Story = {
  name: "Leftover emptyCv rows stay off",
  render: () => {
    const leftover = emptyCv();
    leftover.experience = [{ id: "e1", org: "", role: "", dates: "", bullets: [""] }];
    leftover.education = [{ id: "ed1", school: "", line: "" }];
    leftover.skills = [""];
    return (
      <div className="bg-desk px-5 py-8">
        <PaperPage
          kind="cv"
          content={leftover}
          publishedLines={[{ date: "2026-08-20", words: SATURDAY_CLOSE }]}
          onChange={() => undefined}
          onCommit={() => undefined}
        />
      </div>
    );
  },
};

export const TypedJobName: Story = {
  name: "Café line under the job they typed",
  render: () => {
    const content = emptyCv();
    content.experience = [{ id: "r1", org: "", role: "Closer", dates: "", bullets: [] }];
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
