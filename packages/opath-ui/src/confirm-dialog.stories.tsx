import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

const meta: Meta<typeof ConfirmDialog> = {
  title: "Components/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Destructive only. The confirm button is danger and repeats the consequence. It names the noun in the title.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {
  render: function ConfirmStory() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" type="button" onClick={() => setOpen(true)}>
          Delete
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete this item"
          body="This cannot be undone."
          confirmLabel="Delete this item"
          onConfirm={() => undefined}
        />
      </>
    );
  },
};
