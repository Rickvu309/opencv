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
  },
};

export default preview;
