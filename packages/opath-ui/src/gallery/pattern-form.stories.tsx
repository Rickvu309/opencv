import type { Meta, StoryObj } from "@storybook/react-vite";
import { Band } from "../band";
import { FieldRow, Section } from "../section";
import { Input } from "../input";
import { Textarea } from "../textarea";

const meta: Meta = {
  title: "Patterns/Sectioned form",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
  render: () => (
    <div className="w-[32rem] rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-5">
      <Band title="The editor" />
      <Section label="About">
        <FieldRow label="Name" htmlFor="pattern-name">
          <Input id="pattern-name" defaultValue="Nguyễn Thị Ngọc Ánh" />
        </FieldRow>
        <FieldRow label="Summary" htmlFor="pattern-summary">
          <Textarea id="pattern-summary" placeholder="A few lines" />
        </FieldRow>
      </Section>
    </div>
  ),
};
