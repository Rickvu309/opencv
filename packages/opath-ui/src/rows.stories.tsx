import type { Meta, StoryObj } from "@storybook/react-vite";
import { Row, RowList, RowListHeader } from "./rows";

const meta: Meta<typeof Row> = {
  title: "Primitives/Row",
  component: Row,
};
export default meta;

type Story = StoryObj<typeof Row>;

export const Plain: Story = {
  render: () => (
    <RowList>
      <Row label="Internship at Grab" meta="Logged · arranged" onSelect={() => undefined} />
      <Row label="Cafe shift" meta="Logged · logged" onSelect={() => undefined} />
    </RowList>
  ),
};

export const DriveColumns: Story = {
  render: () => (
    <div className="px-5">
      <RowList bleed>
        <RowListHeader />
        <Row
          label="Untitled CV"
          type="CV"
          updated="2 days ago"
          onSelect={() => undefined}
          menu={
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px]"
              aria-label="Actions for Untitled CV"
            >
              ···
            </button>
          }
        />
        <Row
          label="Cover letter — Grab"
          type="Cover letter"
          updated="1 hour ago"
          onSelect={() => undefined}
          menu={
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px]"
              aria-label="Actions for Cover letter"
            >
              ···
            </button>
          }
        />
        <Row
          label="Linh-CV.pdf"
          type="Uploaded"
          updated="just now"
          href="#uploaded"
          menu={
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px]"
              aria-label="Actions for Linh-CV.pdf"
            >
              ···
            </button>
          }
        />
      </RowList>
    </div>
  ),
};
