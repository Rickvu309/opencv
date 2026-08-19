import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const TablePreview = lazy(() => import("../beui/previews/table.preview").then((m) => ({ default: m.TablePreview })));
const DiffTable = lazy(() => import("../beautiful/diff-table").then((m) => ({ default: m.DiffTable })));
const RecordsTable = lazy(() => import("../beautiful/records-table").then((m) => ({ default: m.RecordsTable })));
const FilterTable = lazy(() => import("../beautiful/filter-table").then((m) => ({ default: m.FilterTable })));
const HeatmapCustomColorsDemo = lazy(() => import("../eightstar/examples/heatmap-custom-colors-demo").then((m) => ({ default: m.default ?? m.HeatmapCustomColorsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapCustomDisplayDemo = lazy(() => import("../eightstar/examples/heatmap-custom-display-demo").then((m) => ({ default: m.default ?? m.HeatmapCustomDisplayDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapDaysOfWeekDemo = lazy(() => import("../eightstar/examples/heatmap-days-of-week-demo").then((m) => ({ default: m.default ?? m.HeatmapDaysOfWeekDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapDemo = lazy(() => import("../eightstar/examples/heatmap-demo").then((m) => ({ default: m.default ?? m.HeatmapDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapDisplayStyleDemo = lazy(() => import("../eightstar/examples/heatmap-display-style-demo").then((m) => ({ default: m.default ?? m.HeatmapDisplayStyleDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapInterpolateDemo = lazy(() => import("../eightstar/examples/heatmap-interpolate-demo").then((m) => ({ default: m.default ?? m.HeatmapInterpolateDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const HeatmapSizeDemo = lazy(() => import("../eightstar/examples/heatmap-size-demo").then((m) => ({ default: m.default ?? m.HeatmapSizeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const JsonViewerDemo = lazy(() => import("../eightstar/examples/json-viewer-demo").then((m) => ({ default: m.default ?? m.JsonViewerDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const JsonViewerFeaturesDemo = lazy(() => import("../eightstar/examples/json-viewer-features-demo").then((m) => ({ default: m.default ?? m.JsonViewerFeaturesDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarAlignmentDemo = lazy(() => import("../eightstar/examples/partition-bar-alignment-demo").then((m) => ({ default: m.default ?? m.PartitionBarAlignmentDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarCustomColoursDemo = lazy(() => import("../eightstar/examples/partition-bar-custom-colours-demo").then((m) => ({ default: m.default ?? m.PartitionBarCustomColoursDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarDemo = lazy(() => import("../eightstar/examples/partition-bar-demo").then((m) => ({ default: m.default ?? m.PartitionBarDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarSizeDemo = lazy(() => import("../eightstar/examples/partition-bar-size-demo").then((m) => ({ default: m.default ?? m.PartitionBarSizeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarVariantsDemo = lazy(() => import("../eightstar/examples/partition-bar-variants-demo").then((m) => ({ default: m.default ?? m.PartitionBarVariantsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const PartitionBarWidthDemo = lazy(() => import("../eightstar/examples/partition-bar-width-demo").then((m) => ({ default: m.default ?? m.PartitionBarWidthDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const RelativeTimeDemo = lazy(() => import("../eightstar/examples/relative-time-demo").then((m) => ({ default: m.default ?? m.RelativeTimeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TimelineDemo = lazy(() => import("../eightstar/examples/timeline-demo").then((m) => ({ default: m.default ?? m.TimelineDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TimelineHollowDemo = lazy(() => import("../eightstar/examples/timeline-hollow-demo").then((m) => ({ default: m.default ?? m.TimelineHollowDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TimelineNocardsDemo = lazy(() => import("../eightstar/examples/timeline-nocards-demo").then((m) => ({ default: m.default ?? m.TimelineNocardsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TimelineNotAlternatingDemo = lazy(() => import("../eightstar/examples/timeline-not-alternating-demo").then((m) => ({ default: m.default ?? m.TimelineNotAlternatingDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TimelineVerticalDemo = lazy(() => import("../eightstar/examples/timeline-vertical-demo").then((m) => ({ default: m.default ?? m.TimelineVerticalDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemoHk = lazy(() => import("../eightstar/examples/transport-badge-demo-hk").then((m) => ({ default: m.default ?? m.TransportBadgeDemoHk ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemoMultiStation = lazy(() => import("../eightstar/examples/transport-badge-demo-multi-station").then((m) => ({ default: m.default ?? m.TransportBadgeDemoMultiStation ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemoSingleStation = lazy(() => import("../eightstar/examples/transport-badge-demo-single-station").then((m) => ({ default: m.default ?? m.TransportBadgeDemoSingleStation ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemoSizes = lazy(() => import("../eightstar/examples/transport-badge-demo-sizes").then((m) => ({ default: m.default ?? m.TransportBadgeDemoSizes ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemoStationName = lazy(() => import("../eightstar/examples/transport-badge-demo-station-name").then((m) => ({ default: m.default ?? m.TransportBadgeDemoStationName ?? Object.values(m).find((v) => typeof v === "function") })));
const TransportBadgeDemo = lazy(() => import("../eightstar/examples/transport-badge-demo").then((m) => ({ default: m.default ?? m.TransportBadgeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const Table01 = lazy(() => import("../blocks-so/table-01/table-01").then((m) => ({ default: m.default ?? m.Table01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Table02 = lazy(() => import("../blocks-so/table-02/table-02").then((m) => ({ default: m.default ?? m.Table02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Table03 = lazy(() => import("../blocks-so/table-03/table-03").then((m) => ({ default: m.default ?? m.Table03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Table04 = lazy(() => import("../blocks-so/table-04/table-04").then((m) => ({ default: m.default ?? m.Table04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Table05 = lazy(() => import("../blocks-so/table-05/table-05").then((m) => ({ default: m.default ?? m.Table05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_AvatarStackHover = lazy(() => import("../kibo/_examples/avatar-stack-hover").then((m) => ({ default: m.default ?? m.Example_AvatarStackHover ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_AvatarStack = lazy(() => import("../kibo/_examples/avatar-stack").then((m) => ({ default: m.default ?? m.Example_AvatarStack ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockDiff = lazy(() => import("../kibo/_examples/code-block-diff").then((m) => ({ default: m.default ?? m.Example_CodeBlockDiff ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockFocus = lazy(() => import("../kibo/_examples/code-block-focus").then((m) => ({ default: m.default ?? m.Example_CodeBlockFocus ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockHeadless = lazy(() => import("../kibo/_examples/code-block-headless").then((m) => ({ default: m.default ?? m.Example_CodeBlockHeadless ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockHighlightLine = lazy(() => import("../kibo/_examples/code-block-highlight-line").then((m) => ({ default: m.default ?? m.Example_CodeBlockHighlightLine ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockHighlightWord = lazy(() => import("../kibo/_examples/code-block-highlight-word").then((m) => ({ default: m.default ?? m.Example_CodeBlockHighlightWord ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockNoHighlighting = lazy(() => import("../kibo/_examples/code-block-no-highlighting").then((m) => ({ default: m.default ?? m.Example_CodeBlockNoHighlighting ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockNumberless = lazy(() => import("../kibo/_examples/code-block-numberless").then((m) => ({ default: m.default ?? m.Example_CodeBlockNumberless ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlockTheme = lazy(() => import("../kibo/_examples/code-block-theme").then((m) => ({ default: m.default ?? m.Example_CodeBlockTheme ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeBlock = lazy(() => import("../kibo/_examples/code-block").then((m) => ({ default: m.default ?? m.Example_CodeBlock ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CodeExample = lazy(() => import("../kibo/_examples/code-example").then((m) => ({ default: m.default ?? m.Example_CodeExample ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphCustomBlocks = lazy(() => import("../kibo/_examples/contribution-graph-custom-blocks").then((m) => ({ default: m.default ?? m.Example_ContributionGraphCustomBlocks ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphCustomFooter = lazy(() => import("../kibo/_examples/contribution-graph-custom-footer").then((m) => ({ default: m.default ?? m.Example_ContributionGraphCustomFooter ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphCustomTheme = lazy(() => import("../kibo/_examples/contribution-graph-custom-theme").then((m) => ({ default: m.default ?? m.Example_ContributionGraphCustomTheme ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphMinimal = lazy(() => import("../kibo/_examples/contribution-graph-minimal").then((m) => ({ default: m.default ?? m.Example_ContributionGraphMinimal ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphSize = lazy(() => import("../kibo/_examples/contribution-graph-size").then((m) => ({ default: m.default ?? m.Example_ContributionGraphSize ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraphTooltip = lazy(() => import("../kibo/_examples/contribution-graph-tooltip").then((m) => ({ default: m.default ?? m.Example_ContributionGraphTooltip ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ContributionGraph = lazy(() => import("../kibo/_examples/contribution-graph").then((m) => ({ default: m.default ?? m.Example_ContributionGraph ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillAvatarGroup = lazy(() => import("../kibo/_examples/pill-avatar-group").then((m) => ({ default: m.default ?? m.Example_PillAvatarGroup ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillAvatar = lazy(() => import("../kibo/_examples/pill-avatar").then((m) => ({ default: m.default ?? m.Example_PillAvatar ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillButton = lazy(() => import("../kibo/_examples/pill-button").then((m) => ({ default: m.default ?? m.Example_PillButton ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillDelta = lazy(() => import("../kibo/_examples/pill-delta").then((m) => ({ default: m.default ?? m.Example_PillDelta ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillIcon = lazy(() => import("../kibo/_examples/pill-icon").then((m) => ({ default: m.default ?? m.Example_PillIcon ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillIndicator = lazy(() => import("../kibo/_examples/pill-indicator").then((m) => ({ default: m.default ?? m.Example_PillIndicator ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_PillStatus = lazy(() => import("../kibo/_examples/pill-status").then((m) => ({ default: m.default ?? m.Example_PillStatus ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Pill = lazy(() => import("../kibo/_examples/pill").then((m) => ({ default: m.default ?? m.Example_Pill ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_QrCodeRobust = lazy(() => import("../kibo/_examples/qr-code-robust").then((m) => ({ default: m.default ?? m.Example_QrCodeRobust ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_QrCodeServer = lazy(() => import("../kibo/_examples/qr-code-server").then((m) => ({ default: m.default ?? m.Example_QrCodeServer ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_QrCodeStyling = lazy(() => import("../kibo/_examples/qr-code-styling").then((m) => ({ default: m.default ?? m.Example_QrCodeStyling ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_QrCode = lazy(() => import("../kibo/_examples/qr-code").then((m) => ({ default: m.default ?? m.Example_QrCode ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RelativeTimeControlled = lazy(() => import("../kibo/_examples/relative-time-controlled").then((m) => ({ default: m.default ?? m.Example_RelativeTimeControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RelativeTimeFormatDate = lazy(() => import("../kibo/_examples/relative-time-format-date").then((m) => ({ default: m.default ?? m.Example_RelativeTimeFormatDate ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RelativeTimeFormatTime = lazy(() => import("../kibo/_examples/relative-time-format-time").then((m) => ({ default: m.default ?? m.Example_RelativeTimeFormatTime ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RelativeTime = lazy(() => import("../kibo/_examples/relative-time").then((m) => ({ default: m.default ?? m.Example_RelativeTime ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_SnippetNpm = lazy(() => import("../kibo/_examples/snippet-npm").then((m) => ({ default: m.default ?? m.Example_SnippetNpm ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Snippet = lazy(() => import("../kibo/_examples/snippet").then((m) => ({ default: m.default ?? m.Example_Snippet ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TableSimple = lazy(() => import("../kibo/_examples/table-simple").then((m) => ({ default: m.default ?? m.Example_TableSimple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Table = lazy(() => import("../kibo/_examples/table").then((m) => ({ default: m.default ?? m.Example_Table ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TickerCurrency = lazy(() => import("../kibo/_examples/ticker-currency").then((m) => ({ default: m.default ?? m.Example_TickerCurrency ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TickerInline = lazy(() => import("../kibo/_examples/ticker-inline").then((m) => ({ default: m.default ?? m.Example_TickerInline ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TickerPercent = lazy(() => import("../kibo/_examples/ticker-percent").then((m) => ({ default: m.default ?? m.Example_TickerPercent ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Ticker = lazy(() => import("../kibo/_examples/ticker").then((m) => ({ default: m.default ?? m.Example_Ticker ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TreeControlled = lazy(() => import("../kibo/_examples/tree-controlled").then((m) => ({ default: m.default ?? m.Example_TreeControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TreeCustomIcons = lazy(() => import("../kibo/_examples/tree-custom-icons").then((m) => ({ default: m.default ?? m.Example_TreeCustomIcons ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TreeNoLines = lazy(() => import("../kibo/_examples/tree-no-lines").then((m) => ({ default: m.default ?? m.Example_TreeNoLines ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TreeSimple = lazy(() => import("../kibo/_examples/tree-simple").then((m) => ({ default: m.default ?? m.Example_TreeSimple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Tree = lazy(() => import("../kibo/_examples/tree").then((m) => ({ default: m.default ?? m.Example_Tree ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Typography = lazy(() => import("../kibo/_examples/typography").then((m) => ({ default: m.default ?? m.Example_Typography ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Data" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiTable: Story = {
  name: "table",
  render: () => (
    <LazyFrame width={560}>
      <TablePreview />
    </LazyFrame>
  ),
};

export const BeautifulDiffTable: Story = {
  name: "Diff Table",
  render: () => (
    <LazyFrame width={520}>
      <DiffTable />
    </LazyFrame>
  ),
};

export const BeautifulRecordsTable: Story = {
  name: "Records Table",
  render: () => (
    <LazyFrame width={640}>
      <RecordsTable />
    </LazyFrame>
  ),
};

export const BeautifulFilterTable: Story = {
  name: "Filter Table",
  render: () => (
    <LazyFrame width={520}>
      <FilterTable />
    </LazyFrame>
  ),
};

export const EightstarHeatmapCustomColorsDemo: Story = {
  name: "heatmap custom colors",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapCustomColorsDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapCustomDisplayDemo: Story = {
  name: "heatmap custom display",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapCustomDisplayDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapDaysOfWeekDemo: Story = {
  name: "heatmap days of week",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapDaysOfWeekDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapDemo: Story = {
  name: "heatmap",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapDisplayStyleDemo: Story = {
  name: "heatmap display style",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapDisplayStyleDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapInterpolateDemo: Story = {
  name: "heatmap interpolate",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapInterpolateDemo />
    </LazyFrame>
  ),
};

export const EightstarHeatmapSizeDemo: Story = {
  name: "heatmap size",
  render: () => (
    <LazyFrame width={640}>
      <HeatmapSizeDemo />
    </LazyFrame>
  ),
};

export const EightstarJsonViewerDemo: Story = {
  name: "json viewer",
  render: () => (
    <LazyFrame width={640}>
      <JsonViewerDemo />
    </LazyFrame>
  ),
};

export const EightstarJsonViewerFeaturesDemo: Story = {
  name: "json viewer features",
  render: () => (
    <LazyFrame width={640}>
      <JsonViewerFeaturesDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarAlignmentDemo: Story = {
  name: "partition bar alignment",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarAlignmentDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarCustomColoursDemo: Story = {
  name: "partition bar custom colours",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarCustomColoursDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarDemo: Story = {
  name: "partition bar",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarSizeDemo: Story = {
  name: "partition bar size",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarSizeDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarVariantsDemo: Story = {
  name: "partition bar variants",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarVariantsDemo />
    </LazyFrame>
  ),
};

export const EightstarPartitionBarWidthDemo: Story = {
  name: "partition bar width",
  render: () => (
    <LazyFrame width={640}>
      <PartitionBarWidthDemo />
    </LazyFrame>
  ),
};

export const EightstarRelativeTimeDemo: Story = {
  name: "relative time",
  render: () => (
    <LazyFrame width={640}>
      <RelativeTimeDemo />
    </LazyFrame>
  ),
};

export const EightstarTimelineDemo: Story = {
  name: "timeline",
  render: () => (
    <LazyFrame width={640}>
      <TimelineDemo />
    </LazyFrame>
  ),
};

export const EightstarTimelineHollowDemo: Story = {
  name: "timeline hollow",
  render: () => (
    <LazyFrame width={640}>
      <TimelineHollowDemo />
    </LazyFrame>
  ),
};

export const EightstarTimelineNocardsDemo: Story = {
  name: "timeline nocards",
  render: () => (
    <LazyFrame width={640}>
      <TimelineNocardsDemo />
    </LazyFrame>
  ),
};

export const EightstarTimelineNotAlternatingDemo: Story = {
  name: "timeline not alternating",
  render: () => (
    <LazyFrame width={640}>
      <TimelineNotAlternatingDemo />
    </LazyFrame>
  ),
};

export const EightstarTimelineVerticalDemo: Story = {
  name: "timeline vertical",
  render: () => (
    <LazyFrame width={640}>
      <TimelineVerticalDemo />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemoHk: Story = {
  name: "transport badge hk",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemoHk />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemoMultiStation: Story = {
  name: "transport badge multi station",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemoMultiStation />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemoSingleStation: Story = {
  name: "transport badge single station",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemoSingleStation />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemoSizes: Story = {
  name: "transport badge sizes",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemoSizes />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemoStationName: Story = {
  name: "transport badge station name",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemoStationName />
    </LazyFrame>
  ),
};

export const EightstarTransportBadgeDemo: Story = {
  name: "transport badge",
  render: () => (
    <LazyFrame width={640}>
      <TransportBadgeDemo />
    </LazyFrame>
  ),
};

export const BlockTable01: Story = {
  name: "table-01",
  render: () => (
    <LazyFrame width={720}>
      <Table01 />
    </LazyFrame>
  ),
};

export const BlockTable02: Story = {
  name: "table-02",
  render: () => (
    <LazyFrame width={720}>
      <Table02 />
    </LazyFrame>
  ),
};

export const BlockTable03: Story = {
  name: "table-03",
  render: () => (
    <LazyFrame width={720}>
      <Table03 />
    </LazyFrame>
  ),
};

export const BlockTable04: Story = {
  name: "table-04",
  render: () => (
    <LazyFrame width={720}>
      <Table04 />
    </LazyFrame>
  ),
};

export const BlockTable05: Story = {
  name: "table-05",
  render: () => (
    <LazyFrame width={720}>
      <Table05 />
    </LazyFrame>
  ),
};

export const KiboAvatarStackHover: Story = {
  name: "avatar stack hover",
  render: () => (
    <LazyFrame width={720}>
      <Example_AvatarStackHover />
    </LazyFrame>
  ),
};

export const KiboAvatarStack: Story = {
  name: "avatar stack",
  render: () => (
    <LazyFrame width={720}>
      <Example_AvatarStack />
    </LazyFrame>
  ),
};

export const KiboCodeBlockDiff: Story = {
  name: "code block diff",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockDiff />
    </LazyFrame>
  ),
};

export const KiboCodeBlockFocus: Story = {
  name: "code block focus",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockFocus />
    </LazyFrame>
  ),
};

export const KiboCodeBlockHeadless: Story = {
  name: "code block headless",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockHeadless />
    </LazyFrame>
  ),
};

export const KiboCodeBlockHighlightLine: Story = {
  name: "code block highlight line",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockHighlightLine />
    </LazyFrame>
  ),
};

export const KiboCodeBlockHighlightWord: Story = {
  name: "code block highlight word",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockHighlightWord />
    </LazyFrame>
  ),
};

export const KiboCodeBlockNoHighlighting: Story = {
  name: "code block no highlighting",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockNoHighlighting />
    </LazyFrame>
  ),
};

export const KiboCodeBlockNumberless: Story = {
  name: "code block numberless",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockNumberless />
    </LazyFrame>
  ),
};

export const KiboCodeBlockTheme: Story = {
  name: "code block theme",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlockTheme />
    </LazyFrame>
  ),
};

export const KiboCodeBlock: Story = {
  name: "code block",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeBlock />
    </LazyFrame>
  ),
};

export const KiboCodeExample: Story = {
  name: "code example",
  render: () => (
    <LazyFrame width={720}>
      <Example_CodeExample />
    </LazyFrame>
  ),
};

export const KiboContributionGraphCustomBlocks: Story = {
  name: "contribution graph custom blocks",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphCustomBlocks />
    </LazyFrame>
  ),
};

export const KiboContributionGraphCustomFooter: Story = {
  name: "contribution graph custom footer",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphCustomFooter />
    </LazyFrame>
  ),
};

export const KiboContributionGraphCustomTheme: Story = {
  name: "contribution graph custom theme",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphCustomTheme />
    </LazyFrame>
  ),
};

export const KiboContributionGraphMinimal: Story = {
  name: "contribution graph minimal",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphMinimal />
    </LazyFrame>
  ),
};

export const KiboContributionGraphSize: Story = {
  name: "contribution graph size",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphSize />
    </LazyFrame>
  ),
};

export const KiboContributionGraphTooltip: Story = {
  name: "contribution graph tooltip",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraphTooltip />
    </LazyFrame>
  ),
};

export const KiboContributionGraph: Story = {
  name: "contribution graph",
  render: () => (
    <LazyFrame width={720}>
      <Example_ContributionGraph />
    </LazyFrame>
  ),
};

export const KiboPillAvatarGroup: Story = {
  name: "pill avatar group",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillAvatarGroup />
    </LazyFrame>
  ),
};

export const KiboPillAvatar: Story = {
  name: "pill avatar",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillAvatar />
    </LazyFrame>
  ),
};

export const KiboPillButton: Story = {
  name: "pill button",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillButton />
    </LazyFrame>
  ),
};

export const KiboPillDelta: Story = {
  name: "pill delta",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillDelta />
    </LazyFrame>
  ),
};

export const KiboPillIcon: Story = {
  name: "pill icon",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillIcon />
    </LazyFrame>
  ),
};

export const KiboPillIndicator: Story = {
  name: "pill indicator",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillIndicator />
    </LazyFrame>
  ),
};

export const KiboPillStatus: Story = {
  name: "pill status",
  render: () => (
    <LazyFrame width={720}>
      <Example_PillStatus />
    </LazyFrame>
  ),
};

export const KiboPill: Story = {
  name: "pill",
  render: () => (
    <LazyFrame width={720}>
      <Example_Pill />
    </LazyFrame>
  ),
};

export const KiboQrCodeRobust: Story = {
  name: "qr code robust",
  render: () => (
    <LazyFrame width={720}>
      <Example_QrCodeRobust />
    </LazyFrame>
  ),
};

export const KiboQrCodeServer: Story = {
  name: "qr code server",
  render: () => (
    <LazyFrame width={720}>
      <Example_QrCodeServer />
    </LazyFrame>
  ),
};

export const KiboQrCodeStyling: Story = {
  name: "qr code styling",
  render: () => (
    <LazyFrame width={720}>
      <Example_QrCodeStyling />
    </LazyFrame>
  ),
};

export const KiboQrCode: Story = {
  name: "qr code",
  render: () => (
    <LazyFrame width={720}>
      <Example_QrCode />
    </LazyFrame>
  ),
};

export const KiboRelativeTimeControlled: Story = {
  name: "relative time controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_RelativeTimeControlled />
    </LazyFrame>
  ),
};

export const KiboRelativeTimeFormatDate: Story = {
  name: "relative time format date",
  render: () => (
    <LazyFrame width={720}>
      <Example_RelativeTimeFormatDate />
    </LazyFrame>
  ),
};

export const KiboRelativeTimeFormatTime: Story = {
  name: "relative time format time",
  render: () => (
    <LazyFrame width={720}>
      <Example_RelativeTimeFormatTime />
    </LazyFrame>
  ),
};

export const KiboRelativeTime: Story = {
  name: "relative time",
  render: () => (
    <LazyFrame width={720}>
      <Example_RelativeTime />
    </LazyFrame>
  ),
};

export const KiboSnippetNpm: Story = {
  name: "snippet npm",
  render: () => (
    <LazyFrame width={720}>
      <Example_SnippetNpm />
    </LazyFrame>
  ),
};

export const KiboSnippet: Story = {
  name: "snippet",
  render: () => (
    <LazyFrame width={720}>
      <Example_Snippet />
    </LazyFrame>
  ),
};

export const KiboTableSimple: Story = {
  name: "table simple",
  render: () => (
    <LazyFrame width={720}>
      <Example_TableSimple />
    </LazyFrame>
  ),
};

export const KiboTable: Story = {
  name: "table",
  render: () => (
    <LazyFrame width={720}>
      <Example_Table />
    </LazyFrame>
  ),
};

export const KiboTickerCurrency: Story = {
  name: "ticker currency",
  render: () => (
    <LazyFrame width={720}>
      <Example_TickerCurrency />
    </LazyFrame>
  ),
};

export const KiboTickerInline: Story = {
  name: "ticker inline",
  render: () => (
    <LazyFrame width={720}>
      <Example_TickerInline />
    </LazyFrame>
  ),
};

export const KiboTickerPercent: Story = {
  name: "ticker percent",
  render: () => (
    <LazyFrame width={720}>
      <Example_TickerPercent />
    </LazyFrame>
  ),
};

export const KiboTicker: Story = {
  name: "ticker",
  render: () => (
    <LazyFrame width={720}>
      <Example_Ticker />
    </LazyFrame>
  ),
};

export const KiboTreeControlled: Story = {
  name: "tree controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_TreeControlled />
    </LazyFrame>
  ),
};

export const KiboTreeCustomIcons: Story = {
  name: "tree custom icons",
  render: () => (
    <LazyFrame width={720}>
      <Example_TreeCustomIcons />
    </LazyFrame>
  ),
};

export const KiboTreeNoLines: Story = {
  name: "tree no lines",
  render: () => (
    <LazyFrame width={720}>
      <Example_TreeNoLines />
    </LazyFrame>
  ),
};

export const KiboTreeSimple: Story = {
  name: "tree simple",
  render: () => (
    <LazyFrame width={720}>
      <Example_TreeSimple />
    </LazyFrame>
  ),
};

export const KiboTree: Story = {
  name: "tree",
  render: () => (
    <LazyFrame width={720}>
      <Example_Tree />
    </LazyFrame>
  ),
};

export const KiboTypography: Story = {
  name: "typography",
  render: () => (
    <LazyFrame width={720}>
      <Example_Typography />
    </LazyFrame>
  ),
};
