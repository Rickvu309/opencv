import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./chip";
import { GroupHeader, Row, RowList } from "./rows";

const meta: Meta<typeof Row> = {
  title: "Components/Row",
  component: Row,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Unit of every Drive list. Hairline-divided. Label leading, meta trailing, optional status chip. Meta wraps under the label before the label truncates.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Row>;

export const Default: Story = {
  render: () => (
    <div className="w-[28rem] overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-5">
      <RowList bleed>
        <Row label="First item" meta="2 days ago" href="#row-1" />
        <Row
          label="Second item"
          meta="Yesterday"
          chip={
            <Chip tone="status" status="progress">
              In progress
            </Chip>
          }
          href="#row-2"
        />
        <Row label="Third item" meta="Today" href="#row-3" />
      </RowList>
    </div>
  ),
};

export const Grouped: Story = {
  render: () => (
    <div className="w-[28rem] overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-5">
      <GroupHeader label="Open" count={2} status="attention" />
      <RowList bleed>
        <Row label="First item" meta="Today" href="#g-1" />
        <Row label="Second item" meta="Yesterday" href="#g-2" />
      </RowList>
    </div>
  ),
};
