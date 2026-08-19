import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { AnimatedSidebarPreview } from "../beui/previews/animated-sidebar.preview";
import { BounceSidebarPreview } from "../beui/previews/bounce-sidebar.preview";
import { DockPreview } from "../beui/previews/dock.preview";
import { PreviewRailPreview } from "../beui/previews/preview-rail.preview";
import { TabsPreview } from "../beui/previews/tabs.preview";
import { SidebarNav } from "../beautiful/sidebar-nav";

const meta = { title: "Lab/Components/Navigation" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiAnimatedSidebar: Story = {
  name: "animated sidebar",
  render: () => (
    <StoryFrame width={560}>
      <AnimatedSidebarPreview />
    </StoryFrame>
  ),
};

export const BeuiBounceSidebar: Story = {
  name: "bounce sidebar",
  render: () => (
    <StoryFrame width={560}>
      <BounceSidebarPreview />
    </StoryFrame>
  ),
};

export const BeuiDock: Story = {
  name: "dock",
  render: () => (
    <StoryFrame width={560}>
      <DockPreview />
    </StoryFrame>
  ),
};

export const BeuiPreviewRail: Story = {
  name: "preview rail",
  render: () => (
    <StoryFrame width={560}>
      <PreviewRailPreview />
    </StoryFrame>
  ),
};

export const BeuiTabs: Story = {
  name: "tabs",
  render: () => (
    <StoryFrame width={560}>
      <TabsPreview />
    </StoryFrame>
  ),
};

export const BeautifulSidebarNav: Story = {
  name: "Sidebar Nav",
  render: () => (
    <StoryFrame width={280} className="bg-canvas p-3">
      <SidebarNav />
    </StoryFrame>
  ),
};
