import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { AnimatedBadgePreview } from "../beui/previews/animated-badge.preview";
import { AnimatedToastStackPreview } from "../beui/previews/animated-toast-stack.preview";
import { LoaderPreview } from "../beui/previews/loader.preview";
import { LoadingState } from "../beautiful/loading-state";
import ShakeDemo from "../eightstar/examples/shake-demo";
import StatusIndicatorDemo from "../eightstar/examples/status-indicator-demo";
import StatusMonitorDemo from "../eightstar/examples/status-monitor-demo";
import StatusMonitorHoursDemo from "../eightstar/examples/status-monitor-hours-demo";
import StatusMonitorSparseDemo from "../eightstar/examples/status-monitor-sparse-demo";
import Example_AnnouncementTagless from "../kibo/_examples/announcement-tagless";
import Example_AnnouncementThemes from "../kibo/_examples/announcement-themes";
import Example_Announcement from "../kibo/_examples/announcement";
import Example_BannerInset from "../kibo/_examples/banner-inset";
import Example_BannerThemes from "../kibo/_examples/banner-themes";
import Example_Banner from "../kibo/_examples/banner";
import Example_CursorColor from "../kibo/_examples/cursor-color";
import Example_CursorMessage from "../kibo/_examples/cursor-message";
import Example_CursorNameMessage from "../kibo/_examples/cursor-name-message";
import Example_CursorName from "../kibo/_examples/cursor-name";
import Example_CursorOnly from "../kibo/_examples/cursor-only";
import Example_Cursor from "../kibo/_examples/cursor";
import Example_SpinnerCustomization from "../kibo/_examples/spinner-customization";
import Example_SpinnerVariants from "../kibo/_examples/spinner-variants";
import Example_Spinner from "../kibo/_examples/spinner";
import Example_StatusCustom from "../kibo/_examples/status-custom";
import Example_Status from "../kibo/_examples/status";

const meta = { title: "Lab/Components/Feedback" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiAnimatedBadge: Story = {
  name: "animated badge",
  render: () => (
    <StoryFrame width={560}>
      <AnimatedBadgePreview />
    </StoryFrame>
  ),
};

export const BeuiAnimatedToastStack: Story = {
  name: "animated toast stack",
  render: () => (
    <StoryFrame width={560}>
      <AnimatedToastStackPreview />
    </StoryFrame>
  ),
};

export const BeuiLoader: Story = {
  name: "loader",
  render: () => (
    <StoryFrame width={560}>
      <LoaderPreview />
    </StoryFrame>
  ),
};

export const BeautifulLoadingState: Story = {
  name: "Loading",
  render: () => (
    <StoryFrame>
      <LoadingState />
    </StoryFrame>
  ),
};

export const EightstarShakeDemo: Story = {
  name: "shake",
  render: () => (
    <StoryFrame width={640}>
      <ShakeDemo />
    </StoryFrame>
  ),
};

export const EightstarStatusIndicatorDemo: Story = {
  name: "status indicator",
  render: () => (
    <StoryFrame width={640}>
      <StatusIndicatorDemo />
    </StoryFrame>
  ),
};

export const EightstarStatusMonitorDemo: Story = {
  name: "status monitor",
  render: () => (
    <StoryFrame width={640}>
      <StatusMonitorDemo />
    </StoryFrame>
  ),
};

export const EightstarStatusMonitorHoursDemo: Story = {
  name: "status monitor hours",
  render: () => (
    <StoryFrame width={640}>
      <StatusMonitorHoursDemo />
    </StoryFrame>
  ),
};

export const EightstarStatusMonitorSparseDemo: Story = {
  name: "status monitor sparse",
  render: () => (
    <StoryFrame width={640}>
      <StatusMonitorSparseDemo />
    </StoryFrame>
  ),
};

export const KiboAnnouncementTagless: Story = {
  name: "announcement tagless",
  render: () => (
    <StoryFrame width={720}>
      <Example_AnnouncementTagless />
    </StoryFrame>
  ),
};

export const KiboAnnouncementThemes: Story = {
  name: "announcement themes",
  render: () => (
    <StoryFrame width={720}>
      <Example_AnnouncementThemes />
    </StoryFrame>
  ),
};

export const KiboAnnouncement: Story = {
  name: "announcement",
  render: () => (
    <StoryFrame width={720}>
      <Example_Announcement />
    </StoryFrame>
  ),
};

export const KiboBannerInset: Story = {
  name: "banner inset",
  render: () => (
    <StoryFrame width={720}>
      <Example_BannerInset />
    </StoryFrame>
  ),
};

export const KiboBannerThemes: Story = {
  name: "banner themes",
  render: () => (
    <StoryFrame width={720}>
      <Example_BannerThemes />
    </StoryFrame>
  ),
};

export const KiboBanner: Story = {
  name: "banner",
  render: () => (
    <StoryFrame width={720}>
      <Example_Banner />
    </StoryFrame>
  ),
};

export const KiboCursorColor: Story = {
  name: "cursor color",
  render: () => (
    <StoryFrame width={720}>
      <Example_CursorColor />
    </StoryFrame>
  ),
};

export const KiboCursorMessage: Story = {
  name: "cursor message",
  render: () => (
    <StoryFrame width={720}>
      <Example_CursorMessage />
    </StoryFrame>
  ),
};

export const KiboCursorNameMessage: Story = {
  name: "cursor name message",
  render: () => (
    <StoryFrame width={720}>
      <Example_CursorNameMessage />
    </StoryFrame>
  ),
};

export const KiboCursorName: Story = {
  name: "cursor name",
  render: () => (
    <StoryFrame width={720}>
      <Example_CursorName />
    </StoryFrame>
  ),
};

export const KiboCursorOnly: Story = {
  name: "cursor only",
  render: () => (
    <StoryFrame width={720}>
      <Example_CursorOnly />
    </StoryFrame>
  ),
};

export const KiboCursor: Story = {
  name: "cursor",
  render: () => (
    <StoryFrame width={720}>
      <Example_Cursor />
    </StoryFrame>
  ),
};

export const KiboSpinnerCustomization: Story = {
  name: "spinner customization",
  render: () => (
    <StoryFrame width={720}>
      <Example_SpinnerCustomization />
    </StoryFrame>
  ),
};

export const KiboSpinnerVariants: Story = {
  name: "spinner variants",
  render: () => (
    <StoryFrame width={720}>
      <Example_SpinnerVariants />
    </StoryFrame>
  ),
};

export const KiboSpinner: Story = {
  name: "spinner",
  render: () => (
    <StoryFrame width={720}>
      <Example_Spinner />
    </StoryFrame>
  ),
};

export const KiboStatusCustom: Story = {
  name: "status custom",
  render: () => (
    <StoryFrame width={720}>
      <Example_StatusCustom />
    </StoryFrame>
  ),
};

export const KiboStatus: Story = {
  name: "status",
  render: () => (
    <StoryFrame width={720}>
      <Example_Status />
    </StoryFrame>
  ),
};
