import type { Meta, StoryObj } from "@storybook/react-vite";
import { createColumnHelper, DataTable } from "../table";

const helper = createColumnHelper<{ role: string; company: string }>();

const meta: Meta = {
  title: "Components/Table",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
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
