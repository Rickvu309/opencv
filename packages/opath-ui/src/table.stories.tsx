import type { Meta, StoryObj } from "@storybook/react-vite";
import { createColumnHelper, DataTable } from "./table";

const helper = createColumnHelper<{ role: string; company: string }>();

const meta: Meta<typeof DataTable> = {
  title: "Components/Table",
  component: DataTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dense column sets. Drive lists are Rows, not this block. Status lives in a Chip slot.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTable>;

export const Default: Story = {
  render: () => (
    <div className="w-[32rem]">
      <DataTable
        columns={[
          helper.accessor("role", { header: "Role" }),
          helper.accessor("company", { header: "Company" }),
        ]}
        data={[
          { role: "Analyst", company: "One" },
          { role: "Intern", company: "Two" },
        ]}
      />
    </div>
  ),
};
