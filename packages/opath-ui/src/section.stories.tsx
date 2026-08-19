import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { FieldRow, Section } from "./section";

const meta: Meta<typeof Section> = {
  title: "Layouts/Section",
  component: Section,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Titled block inside an editor. FieldRow is the label-plus-control pair used on settings and profile.",
      },
    },
  },
  args: { label: "About" },
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[32rem]">
      <Section {...args}>
        <FieldRow label="Name" htmlFor="section-name">
          <Input id="section-name" defaultValue="Row label" />
        </FieldRow>
      </Section>
    </div>
  ),
};
