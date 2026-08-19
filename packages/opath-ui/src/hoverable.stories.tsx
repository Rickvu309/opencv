import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Hoverable } from "./hoverable";

const meta: Meta<typeof Hoverable.Root> = {
  title: "Core/Hoverable",
  component: Hoverable.Root,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "CSS-only reveal for sibling controls. On hover:none the revealed state is permanent so row menus stay reachable on phones.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Hoverable.Root>;

export const Default: Story = {
  render: () => (
    <Hoverable.Root className="flex w-[20rem] items-center justify-between rounded-[var(--radius-control)] border border-hairline px-3 py-2">
      <span className="text-[15px] font-[510]">Row label</span>
      <Hoverable.Item>
        <Button variant="ghost" type="button" className="min-h-10 px-2">
          ···
        </Button>
      </Hoverable.Item>
    </Hoverable.Root>
  ),
};
