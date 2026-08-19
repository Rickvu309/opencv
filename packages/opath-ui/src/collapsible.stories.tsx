import type { Meta, StoryObj } from "@storybook/react-vite";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const meta: Meta<typeof Collapsible> = {
  title: "Components/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Used by the reasoning panel, tool call, and approval card. Chevron is reserved on the right so rows never shift.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Collapsible>
        <CollapsibleTrigger className="text-[13px]">Show more</CollapsibleTrigger>
        <CollapsibleContent className="pt-2 text-[13px] text-ink-muted">
          Hidden until opened.
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};
