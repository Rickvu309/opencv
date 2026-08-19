import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const AnimatedBadgePreview = lazy(() => import("../beui/previews/animated-badge.preview").then((m) => ({ default: m.AnimatedBadgePreview })));
const AnimatedToastStackPreview = lazy(() => import("../beui/previews/animated-toast-stack.preview").then((m) => ({ default: m.AnimatedToastStackPreview })));
const LoaderPreview = lazy(() => import("../beui/previews/loader.preview").then((m) => ({ default: m.LoaderPreview })));
const LoadingState = lazy(() => import("../beautiful/loading-state").then((m) => ({ default: m.LoadingState })));
const ShakeDemo = lazy(() => import("../eightstar/examples/shake-demo").then((m) => ({ default: m.default ?? m.ShakeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const StatusIndicatorDemo = lazy(() => import("../eightstar/examples/status-indicator-demo").then((m) => ({ default: m.default ?? m.StatusIndicatorDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const StatusMonitorDemo = lazy(() => import("../eightstar/examples/status-monitor-demo").then((m) => ({ default: m.default ?? m.StatusMonitorDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const StatusMonitorHoursDemo = lazy(() => import("../eightstar/examples/status-monitor-hours-demo").then((m) => ({ default: m.default ?? m.StatusMonitorHoursDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const StatusMonitorSparseDemo = lazy(() => import("../eightstar/examples/status-monitor-sparse-demo").then((m) => ({ default: m.default ?? m.StatusMonitorSparseDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_AnnouncementTagless = lazy(() => import("../kibo/_examples/announcement-tagless").then((m) => ({ default: m.default ?? m.Example_AnnouncementTagless ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_AnnouncementThemes = lazy(() => import("../kibo/_examples/announcement-themes").then((m) => ({ default: m.default ?? m.Example_AnnouncementThemes ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Announcement = lazy(() => import("../kibo/_examples/announcement").then((m) => ({ default: m.default ?? m.Example_Announcement ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_BannerInset = lazy(() => import("../kibo/_examples/banner-inset").then((m) => ({ default: m.default ?? m.Example_BannerInset ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_BannerThemes = lazy(() => import("../kibo/_examples/banner-themes").then((m) => ({ default: m.default ?? m.Example_BannerThemes ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Banner = lazy(() => import("../kibo/_examples/banner").then((m) => ({ default: m.default ?? m.Example_Banner ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CursorColor = lazy(() => import("../kibo/_examples/cursor-color").then((m) => ({ default: m.default ?? m.Example_CursorColor ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CursorMessage = lazy(() => import("../kibo/_examples/cursor-message").then((m) => ({ default: m.default ?? m.Example_CursorMessage ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CursorNameMessage = lazy(() => import("../kibo/_examples/cursor-name-message").then((m) => ({ default: m.default ?? m.Example_CursorNameMessage ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CursorName = lazy(() => import("../kibo/_examples/cursor-name").then((m) => ({ default: m.default ?? m.Example_CursorName ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CursorOnly = lazy(() => import("../kibo/_examples/cursor-only").then((m) => ({ default: m.default ?? m.Example_CursorOnly ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Cursor = lazy(() => import("../kibo/_examples/cursor").then((m) => ({ default: m.default ?? m.Example_Cursor ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_SpinnerCustomization = lazy(() => import("../kibo/_examples/spinner-customization").then((m) => ({ default: m.default ?? m.Example_SpinnerCustomization ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_SpinnerVariants = lazy(() => import("../kibo/_examples/spinner-variants").then((m) => ({ default: m.default ?? m.Example_SpinnerVariants ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Spinner = lazy(() => import("../kibo/_examples/spinner").then((m) => ({ default: m.default ?? m.Example_Spinner ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_StatusCustom = lazy(() => import("../kibo/_examples/status-custom").then((m) => ({ default: m.default ?? m.Example_StatusCustom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Status = lazy(() => import("../kibo/_examples/status").then((m) => ({ default: m.default ?? m.Example_Status ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Feedback" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiAnimatedBadge: Story = {
  name: "animated badge",
  render: () => (
    <LazyFrame width={560}>
      <AnimatedBadgePreview />
    </LazyFrame>
  ),
};

export const BeuiAnimatedToastStack: Story = {
  name: "animated toast stack",
  render: () => (
    <LazyFrame width={560}>
      <AnimatedToastStackPreview />
    </LazyFrame>
  ),
};

export const BeuiLoader: Story = {
  name: "loader",
  render: () => (
    <LazyFrame width={560}>
      <LoaderPreview />
    </LazyFrame>
  ),
};

export const BeautifulLoadingState: Story = {
  name: "Loading",
  render: () => (
    <LazyFrame>
      <LoadingState />
    </LazyFrame>
  ),
};

export const EightstarShakeDemo: Story = {
  name: "shake",
  render: () => (
    <LazyFrame width={640}>
      <ShakeDemo />
    </LazyFrame>
  ),
};

export const EightstarStatusIndicatorDemo: Story = {
  name: "status indicator",
  render: () => (
    <LazyFrame width={640}>
      <StatusIndicatorDemo />
    </LazyFrame>
  ),
};

export const EightstarStatusMonitorDemo: Story = {
  name: "status monitor",
  render: () => (
    <LazyFrame width={640}>
      <StatusMonitorDemo />
    </LazyFrame>
  ),
};

export const EightstarStatusMonitorHoursDemo: Story = {
  name: "status monitor hours",
  render: () => (
    <LazyFrame width={640}>
      <StatusMonitorHoursDemo />
    </LazyFrame>
  ),
};

export const EightstarStatusMonitorSparseDemo: Story = {
  name: "status monitor sparse",
  render: () => (
    <LazyFrame width={640}>
      <StatusMonitorSparseDemo />
    </LazyFrame>
  ),
};

export const KiboAnnouncementTagless: Story = {
  name: "announcement tagless",
  render: () => (
    <LazyFrame width={720}>
      <Example_AnnouncementTagless />
    </LazyFrame>
  ),
};

export const KiboAnnouncementThemes: Story = {
  name: "announcement themes",
  render: () => (
    <LazyFrame width={720}>
      <Example_AnnouncementThemes />
    </LazyFrame>
  ),
};

export const KiboAnnouncement: Story = {
  name: "announcement",
  render: () => (
    <LazyFrame width={720}>
      <Example_Announcement />
    </LazyFrame>
  ),
};

export const KiboBannerInset: Story = {
  name: "banner inset",
  render: () => (
    <LazyFrame width={720}>
      <Example_BannerInset />
    </LazyFrame>
  ),
};

export const KiboBannerThemes: Story = {
  name: "banner themes",
  render: () => (
    <LazyFrame width={720}>
      <Example_BannerThemes />
    </LazyFrame>
  ),
};

export const KiboBanner: Story = {
  name: "banner",
  render: () => (
    <LazyFrame width={720}>
      <Example_Banner />
    </LazyFrame>
  ),
};

export const KiboCursorColor: Story = {
  name: "cursor color",
  render: () => (
    <LazyFrame width={720}>
      <Example_CursorColor />
    </LazyFrame>
  ),
};

export const KiboCursorMessage: Story = {
  name: "cursor message",
  render: () => (
    <LazyFrame width={720}>
      <Example_CursorMessage />
    </LazyFrame>
  ),
};

export const KiboCursorNameMessage: Story = {
  name: "cursor name message",
  render: () => (
    <LazyFrame width={720}>
      <Example_CursorNameMessage />
    </LazyFrame>
  ),
};

export const KiboCursorName: Story = {
  name: "cursor name",
  render: () => (
    <LazyFrame width={720}>
      <Example_CursorName />
    </LazyFrame>
  ),
};

export const KiboCursorOnly: Story = {
  name: "cursor only",
  render: () => (
    <LazyFrame width={720}>
      <Example_CursorOnly />
    </LazyFrame>
  ),
};

export const KiboCursor: Story = {
  name: "cursor",
  render: () => (
    <LazyFrame width={720}>
      <Example_Cursor />
    </LazyFrame>
  ),
};

export const KiboSpinnerCustomization: Story = {
  name: "spinner customization",
  render: () => (
    <LazyFrame width={720}>
      <Example_SpinnerCustomization />
    </LazyFrame>
  ),
};

export const KiboSpinnerVariants: Story = {
  name: "spinner variants",
  render: () => (
    <LazyFrame width={720}>
      <Example_SpinnerVariants />
    </LazyFrame>
  ),
};

export const KiboSpinner: Story = {
  name: "spinner",
  render: () => (
    <LazyFrame width={720}>
      <Example_Spinner />
    </LazyFrame>
  ),
};

export const KiboStatusCustom: Story = {
  name: "status custom",
  render: () => (
    <LazyFrame width={720}>
      <Example_StatusCustom />
    </LazyFrame>
  ),
};

export const KiboStatus: Story = {
  name: "status",
  render: () => (
    <LazyFrame width={720}>
      <Example_Status />
    </LazyFrame>
  ),
};
