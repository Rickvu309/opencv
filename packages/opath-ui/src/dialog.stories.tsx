import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Centered overlay. Focus trapped. Esc and scrim close. Focus returns to the opener. Title then body then Cancel plus the verb.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          Open dialog
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">
          Dialog title
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13px] leading-[1.5] text-ink-secondary">
          A short body with one next step.
        </DialogDescription>
        <div className="mt-4 flex justify-end">
          <Button type="button">Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  ),
};
