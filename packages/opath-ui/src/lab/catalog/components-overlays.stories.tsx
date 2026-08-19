import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { BottomSheetPreview } from "../beui/previews/bottom-sheet.preview";
import { CenterMorphModalPreview } from "../beui/previews/center-morph-modal.preview";
import { ContextMenuPreview } from "../beui/previews/context-menu.preview";
import { DrawerPreview } from "../beui/previews/drawer.preview";
import { MorphingModalPreview } from "../beui/previews/morphing-modal.preview";
import { PopoverPreview } from "../beui/previews/popover.preview";
import { TooltipPreview } from "../beui/previews/tooltip.preview";
import Example_DialogStackControlled from "../kibo/_examples/dialog-stack-controlled";
import Example_DialogStackNavigation from "../kibo/_examples/dialog-stack-navigation";
import Example_DialogStackSix from "../kibo/_examples/dialog-stack-six";
import Example_DialogStack from "../kibo/_examples/dialog-stack";
import Example_GlimpseCustom from "../kibo/_examples/glimpse-custom";
import Example_Glimpse from "../kibo/_examples/glimpse";

const meta = { title: "Lab/Components/Overlays" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiBottomSheet: Story = {
  name: "bottom sheet",
  render: () => (
    <StoryFrame width={560}>
      <BottomSheetPreview />
    </StoryFrame>
  ),
};

export const BeuiCenterMorphModal: Story = {
  name: "center morph modal",
  render: () => (
    <StoryFrame width={560}>
      <CenterMorphModalPreview />
    </StoryFrame>
  ),
};

export const BeuiContextMenu: Story = {
  name: "context menu",
  render: () => (
    <StoryFrame width={560}>
      <ContextMenuPreview />
    </StoryFrame>
  ),
};

export const BeuiDrawer: Story = {
  name: "drawer",
  render: () => (
    <StoryFrame width={560}>
      <DrawerPreview />
    </StoryFrame>
  ),
};

export const BeuiMorphingModal: Story = {
  name: "morphing modal",
  render: () => (
    <StoryFrame width={560}>
      <MorphingModalPreview />
    </StoryFrame>
  ),
};

export const BeuiPopover: Story = {
  name: "popover",
  render: () => (
    <StoryFrame width={560}>
      <PopoverPreview />
    </StoryFrame>
  ),
};

export const BeuiTooltip: Story = {
  name: "tooltip",
  render: () => (
    <StoryFrame width={560}>
      <TooltipPreview />
    </StoryFrame>
  ),
};

export const KiboDialogStackControlled: Story = {
  name: "dialog stack controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_DialogStackControlled />
    </StoryFrame>
  ),
};

export const KiboDialogStackNavigation: Story = {
  name: "dialog stack navigation",
  render: () => (
    <StoryFrame width={720}>
      <Example_DialogStackNavigation />
    </StoryFrame>
  ),
};

export const KiboDialogStackSix: Story = {
  name: "dialog stack six",
  render: () => (
    <StoryFrame width={720}>
      <Example_DialogStackSix />
    </StoryFrame>
  ),
};

export const KiboDialogStack: Story = {
  name: "dialog stack",
  render: () => (
    <StoryFrame width={720}>
      <Example_DialogStack />
    </StoryFrame>
  ),
};

export const KiboGlimpseCustom: Story = {
  name: "glimpse custom",
  render: () => (
    <StoryFrame width={720}>
      <Example_GlimpseCustom />
    </StoryFrame>
  ),
};

export const KiboGlimpse: Story = {
  name: "glimpse",
  render: () => (
    <StoryFrame width={720}>
      <Example_Glimpse />
    </StoryFrame>
  ),
};
