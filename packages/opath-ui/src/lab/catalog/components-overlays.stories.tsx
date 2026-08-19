import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const BottomSheetPreview = lazy(() => import("../beui/previews/bottom-sheet.preview").then((m) => ({ default: m.BottomSheetPreview })));
const CenterMorphModalPreview = lazy(() => import("../beui/previews/center-morph-modal.preview").then((m) => ({ default: m.CenterMorphModalPreview })));
const ContextMenuPreview = lazy(() => import("../beui/previews/context-menu.preview").then((m) => ({ default: m.ContextMenuPreview })));
const DrawerPreview = lazy(() => import("../beui/previews/drawer.preview").then((m) => ({ default: m.DrawerPreview })));
const MorphingModalPreview = lazy(() => import("../beui/previews/morphing-modal.preview").then((m) => ({ default: m.MorphingModalPreview })));
const PopoverPreview = lazy(() => import("../beui/previews/popover.preview").then((m) => ({ default: m.PopoverPreview })));
const TooltipPreview = lazy(() => import("../beui/previews/tooltip.preview").then((m) => ({ default: m.TooltipPreview })));
const Example_DialogStackControlled = lazy(() => import("../kibo/_examples/dialog-stack-controlled").then((m) => ({ default: m.default ?? m.Example_DialogStackControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DialogStackNavigation = lazy(() => import("../kibo/_examples/dialog-stack-navigation").then((m) => ({ default: m.default ?? m.Example_DialogStackNavigation ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DialogStackSix = lazy(() => import("../kibo/_examples/dialog-stack-six").then((m) => ({ default: m.default ?? m.Example_DialogStackSix ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DialogStack = lazy(() => import("../kibo/_examples/dialog-stack").then((m) => ({ default: m.default ?? m.Example_DialogStack ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_GlimpseCustom = lazy(() => import("../kibo/_examples/glimpse-custom").then((m) => ({ default: m.default ?? m.Example_GlimpseCustom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Glimpse = lazy(() => import("../kibo/_examples/glimpse").then((m) => ({ default: m.default ?? m.Example_Glimpse ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Overlays" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiBottomSheet: Story = {
  name: "bottom sheet",
  render: () => (
    <LazyFrame width={560}>
      <BottomSheetPreview />
    </LazyFrame>
  ),
};

export const BeuiCenterMorphModal: Story = {
  name: "center morph modal",
  render: () => (
    <LazyFrame width={560}>
      <CenterMorphModalPreview />
    </LazyFrame>
  ),
};

export const BeuiContextMenu: Story = {
  name: "context menu",
  render: () => (
    <LazyFrame width={560}>
      <ContextMenuPreview />
    </LazyFrame>
  ),
};

export const BeuiDrawer: Story = {
  name: "drawer",
  render: () => (
    <LazyFrame width={560}>
      <DrawerPreview />
    </LazyFrame>
  ),
};

export const BeuiMorphingModal: Story = {
  name: "morphing modal",
  render: () => (
    <LazyFrame width={560}>
      <MorphingModalPreview />
    </LazyFrame>
  ),
};

export const BeuiPopover: Story = {
  name: "popover",
  render: () => (
    <LazyFrame width={560}>
      <PopoverPreview />
    </LazyFrame>
  ),
};

export const BeuiTooltip: Story = {
  name: "tooltip",
  render: () => (
    <LazyFrame width={560}>
      <TooltipPreview />
    </LazyFrame>
  ),
};

export const KiboDialogStackControlled: Story = {
  name: "dialog stack controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_DialogStackControlled />
    </LazyFrame>
  ),
};

export const KiboDialogStackNavigation: Story = {
  name: "dialog stack navigation",
  render: () => (
    <LazyFrame width={720}>
      <Example_DialogStackNavigation />
    </LazyFrame>
  ),
};

export const KiboDialogStackSix: Story = {
  name: "dialog stack six",
  render: () => (
    <LazyFrame width={720}>
      <Example_DialogStackSix />
    </LazyFrame>
  ),
};

export const KiboDialogStack: Story = {
  name: "dialog stack",
  render: () => (
    <LazyFrame width={720}>
      <Example_DialogStack />
    </LazyFrame>
  ),
};

export const KiboGlimpseCustom: Story = {
  name: "glimpse custom",
  render: () => (
    <LazyFrame width={720}>
      <Example_GlimpseCustom />
    </LazyFrame>
  ),
};

export const KiboGlimpse: Story = {
  name: "glimpse",
  render: () => (
    <LazyFrame width={720}>
      <Example_Glimpse />
    </LazyFrame>
  ),
};
