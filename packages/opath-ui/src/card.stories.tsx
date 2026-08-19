import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, EmptyMessageCard, EndOfList } from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Surface-1, hairline, radius-container, 16px padding. EmptyMessageCard is the in-thread nothing-yet. EndOfList is a quiet caption after a Drive list.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[20rem]">
      <p className="text-[15px] font-[510]">Card label</p>
      <p className="mt-1 text-[13px] text-ink-muted">Meta line</p>
    </Card>
  ),
};

export const EmptyMessage: Story = {
  render: () => (
    <div className="w-[20rem]">
      <EmptyMessageCard
        title="Nothing in this thread yet."
        action={<Button variant="ghost">Start one</Button>}
      />
    </div>
  ),
};

export const End: Story = {
  render: () => <EndOfList />,
};
