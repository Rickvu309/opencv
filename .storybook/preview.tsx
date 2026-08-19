import type { Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import "../src/styles/globals.css";
import { TooltipProvider } from "@/ui/tooltip";
import { AppToaster } from "@/ui/toaster";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Decorators({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <AppToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <Decorators>
        <Story />
      </Decorators>
    ),
  ],
  parameters: {
    layout: "centered",
    a11y: { test: "todo" },
    backgrounds: { disabled: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: [
          "Getting Started",
          "Foundations",
          ["Color", "Type", "Space", "Motion"],
          "Core",
          ["Interactive", "Hoverable"],
          "Components",
          [
            "Button",
            "Chip",
            "SuggestionList",
            "Input",
            "Textarea",
            "Label",
            "Checkbox",
            "Switch",
            "Tabs",
            "Table",
            "Tooltip",
            "DropdownMenu",
            "Dialog",
            "ConfirmDialog",
            "Sheet",
            "Collapsible",
            "Loader",
            "InfoBlock",
            "Code",
            "CopyButton",
            "Keycap",
            "Skeleton",
            "Card",
            "Empty",
            "Row",
            "Mark",
            "Truncated",
          ],
          "Layouts",
          ["Band", "Section", "SkipLink"],
          "Patterns",
          ["Drive list", "Sectioned form", "Suggestions"],
          "Screens",
          [
            "Coach",
            "Auth",
            "Landing",
            "Onboarding",
            "Profile",
            "Settings",
            "Paper",
            "Search",
            "Apply",
            "Pitch",
            "Proof",
            "Share",
          ],
        ],
      },
    },
  },
};

export default preview;
