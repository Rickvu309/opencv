import type { Meta, StoryObj } from "@storybook/react-vite";
import { SuggestionList } from "../suggestion-list";

const meta: Meta = {
  title: "Patterns/Suggestions",
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col items-center gap-3 py-8">
      <p className="text-[15px] leading-[1.6]">What do you want to do.</p>
      <SuggestionList
        items={[
          { id: "one", label: "Start something" },
          { id: "two", label: "Look at openings" },
        ]}
        onPick={() => undefined}
      />
    </div>
  ),
};
