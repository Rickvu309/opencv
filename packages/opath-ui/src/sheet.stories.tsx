import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Drawer or bottom sheet. Esc and scrim close. Left is the rail drawer. Bottom is the mobile dock sheet.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
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

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" type="button">
          Open sheet
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <div className="p-4">
          <SheetTitle className="text-[15px] font-[510]">Sheet</SheetTitle>
          <p className="mt-2 text-[13px] text-ink-muted">70vh from the bottom.</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
