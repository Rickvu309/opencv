import type { Preview } from "@storybook/react-vite";
import type { ReactNode } from "react";
import "../../../src/styles/globals.css";
import "../src/lab/tokens.css";
import { TooltipProvider } from "../src/tooltip";
import { AppToaster } from "../src/toaster";

function Decorators({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <AppToaster />
    </TooltipProvider>
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
