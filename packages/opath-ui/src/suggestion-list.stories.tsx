import type { Meta, StoryObj } from "@storybook/react-vite";
import { SuggestionList } from "./suggestion-list";

const meta: Meta<typeof SuggestionList> = {
  title: "Components/SuggestionList",
  component: SuggestionList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Empty Coach under the composer. Outline pills. Clicking fills the composer; it does not send.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SuggestionList>;

export const Default: Story = {
  args: {
    items: [
      { id: "one", label: "Start something" },
      { id: "two", label: "Look at openings" },
    ],
    onPick: () => undefined,
  },
};
