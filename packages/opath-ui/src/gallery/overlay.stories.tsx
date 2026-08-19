import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { ConfirmDialog } from "../confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../sheet";
import { Tooltip } from "../tooltip";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Components/Overlay",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const TooltipRest: Story = {
  render: () => (
    <Tooltip tooltip="A short explanation">
      <button type="button" className="text-[13px] text-accent underline">
        Hover for a tip
      </button>
    </Tooltip>
  ),
};

export const Menu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" type="button">
          ···
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const DialogRest: Story = {
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

export const Confirm: Story = {
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

export const SheetRest: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" type="button">
          Open sheet
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <div className="p-4">
          <SheetTitle className="text-[15px] font-[510]">Menu</SheetTitle>
          <p className="mt-2 text-[13px] text-ink-muted">Drawer from the left. Esc and scrim close.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Collapse: Story = {
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

export const All: Story = {
  render: () => (
    <GalleryPage title="Overlay" note="Focus trapped. Esc and scrim close. Focus returns to the opener.">
      <GallerySection title="Tooltip and menu">
        <div className="flex items-center gap-3">
          <Tooltip tooltip="A short explanation">
            <button type="button" className="text-[13px] text-accent underline">
              Tip
            </button>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" type="button">
                ···
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </GallerySection>
    </GalleryPage>
  ),
};
