import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const AnimatedSidebarPreview = lazy(() => import("../beui/previews/animated-sidebar.preview").then((m) => ({ default: m.AnimatedSidebarPreview })));
const BounceSidebarPreview = lazy(() => import("../beui/previews/bounce-sidebar.preview").then((m) => ({ default: m.BounceSidebarPreview })));
const DockPreview = lazy(() => import("../beui/previews/dock.preview").then((m) => ({ default: m.DockPreview })));
const PreviewRailPreview = lazy(() => import("../beui/previews/preview-rail.preview").then((m) => ({ default: m.PreviewRailPreview })));
const TabsPreview = lazy(() => import("../beui/previews/tabs.preview").then((m) => ({ default: m.TabsPreview })));
const SidebarNav = lazy(() => import("../beautiful/sidebar-nav").then((m) => ({ default: m.SidebarNav })));

const meta = { title: "Lab/Components/Navigation" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiAnimatedSidebar: Story = {
  name: "animated sidebar",
  render: () => (
    <LazyFrame width={560}>
      <AnimatedSidebarPreview />
    </LazyFrame>
  ),
};

export const BeuiBounceSidebar: Story = {
  name: "bounce sidebar",
  render: () => (
    <LazyFrame width={560}>
      <BounceSidebarPreview />
    </LazyFrame>
  ),
};

export const BeuiDock: Story = {
  name: "dock",
  render: () => (
    <LazyFrame width={560}>
      <DockPreview />
    </LazyFrame>
  ),
};

export const BeuiPreviewRail: Story = {
  name: "preview rail",
  render: () => (
    <LazyFrame width={560}>
      <PreviewRailPreview />
    </LazyFrame>
  ),
};

export const BeuiTabs: Story = {
  name: "tabs",
  render: () => (
    <LazyFrame width={560}>
      <TabsPreview />
    </LazyFrame>
  ),
};

export const BeautifulSidebarNav: Story = {
  name: "Sidebar Nav",
  render: () => (
    <LazyFrame width={280} className="bg-canvas p-3">
      <SidebarNav />
    </LazyFrame>
  ),
};
