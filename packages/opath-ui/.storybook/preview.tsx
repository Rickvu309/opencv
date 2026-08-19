import type { Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import "./preview.css";
import { TooltipProvider } from "../src/tooltip";
import { AppToaster } from "../src/toaster";

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
    options: {
      storySort: {
        order: ["Primitives", "Lab", ["Components", "Templates"]],
      },
    },
  },
};

export default preview;
