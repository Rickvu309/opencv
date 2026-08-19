import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const ActionSwapPreview = lazy(() => import("../beui/previews/action-swap.preview").then((m) => ({ default: m.ActionSwapPreview })));
const ButtonPreview = lazy(() => import("../beui/previews/button.preview").then((m) => ({ default: m.ButtonPreview })));
const ExpandingArrowButtonPreview = lazy(() => import("../beui/previews/expanding-arrow-button.preview").then((m) => ({ default: m.ExpandingArrowButtonPreview })));
const SelectionActions = lazy(() => import("../beautiful/selection-actions").then((m) => ({ default: m.SelectionActions })));
const ButtonDemo = lazy(() => import("../eightstar/examples/button-demo").then((m) => ({ default: m.default ?? m.ButtonDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ThemeSwitcherUncontrolled = lazy(() => import("../kibo/_examples/theme-switcher-uncontrolled").then((m) => ({ default: m.default ?? m.Example_ThemeSwitcherUncontrolled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ThemeSwitcher = lazy(() => import("../kibo/_examples/theme-switcher").then((m) => ({ default: m.default ?? m.Example_ThemeSwitcher ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Actions" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiActionSwap: Story = {
  name: "action swap",
  render: () => (
    <LazyFrame width={560}>
      <ActionSwapPreview />
    </LazyFrame>
  ),
};

export const BeuiButton: Story = {
  name: "button",
  render: () => (
    <LazyFrame width={560}>
      <ButtonPreview />
    </LazyFrame>
  ),
};

export const BeuiExpandingArrowButton: Story = {
  name: "expanding arrow button",
  render: () => (
    <LazyFrame width={560}>
      <ExpandingArrowButtonPreview />
    </LazyFrame>
  ),
};

export const BeautifulSelectionActions: Story = {
  name: "Selection Actions",
  render: () => (
    <LazyFrame width={560}>
      <SelectionActions />
    </LazyFrame>
  ),
};

export const EightstarButtonDemo: Story = {
  name: "button",
  render: () => (
    <LazyFrame width={640}>
      <ButtonDemo />
    </LazyFrame>
  ),
};

export const KiboThemeSwitcherUncontrolled: Story = {
  name: "theme switcher uncontrolled",
  render: () => (
    <LazyFrame width={720}>
      <Example_ThemeSwitcherUncontrolled />
    </LazyFrame>
  ),
};

export const KiboThemeSwitcher: Story = {
  name: "theme switcher",
  render: () => (
    <LazyFrame width={720}>
      <Example_ThemeSwitcher />
    </LazyFrame>
  ),
};
