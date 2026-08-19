import type { Meta, StoryObj } from "@storybook/react-vite";
import { Code } from "./code";

const meta: Meta<typeof Code> = {
  title: "Components/Code",
  component: Code,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Payload view. Mono 13px on surface-2. CopyButton is a Hoverable ghost at the top-right.",
      },
    },
  },
  args: { value: "noun.verb", children: "noun.verb" },
};

export default meta;
type Story = StoryObj<typeof Code>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[20rem]">
      <Code {...args} />
    </div>
  ),
};
