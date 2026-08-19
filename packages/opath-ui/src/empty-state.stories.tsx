import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Components/Empty",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One sentence, optional basis, one action. First-run, cleared, filtered, error, and offline are copy variants of this template.",
      },
    },
  },
  args: {
    kind: "first-run",
    title: "Nothing in this list yet.",
    action: <Button>Start one</Button>,
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithBasis: Story = {
  args: {
    kind: "cleared",
    title: "Nothing matches this filter.",
    basis: "12 items are hidden by the current filter.",
    action: (
      <Button variant="ghost" type="button">
        Clear filter
      </Button>
    ),
  },
};

export const Error: Story = {
  args: {
    kind: "error",
    title: "Couldn't load this. Try again.",
    action: (
      <Button variant="outline" type="button">
        Try again
      </Button>
    ),
  },
};

export const Offline: Story = {
  args: {
    kind: "offline",
    title: "You're offline. This will load when you're back.",
    action: undefined,
  },
};
