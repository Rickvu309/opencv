import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { TablePreview } from "../beui/previews/table.preview";
import { DiffTable } from "../beautiful/diff-table";
import { RecordsTable } from "../beautiful/records-table";
import { FilterTable } from "../beautiful/filter-table";
import HeatmapCustomColorsDemo from "../eightstar/examples/heatmap-custom-colors-demo";
import HeatmapCustomDisplayDemo from "../eightstar/examples/heatmap-custom-display-demo";
import HeatmapDaysOfWeekDemo from "../eightstar/examples/heatmap-days-of-week-demo";
import HeatmapDemo from "../eightstar/examples/heatmap-demo";
import HeatmapDisplayStyleDemo from "../eightstar/examples/heatmap-display-style-demo";
import HeatmapInterpolateDemo from "../eightstar/examples/heatmap-interpolate-demo";
import HeatmapSizeDemo from "../eightstar/examples/heatmap-size-demo";
import JsonViewerDemo from "../eightstar/examples/json-viewer-demo";
import JsonViewerFeaturesDemo from "../eightstar/examples/json-viewer-features-demo";
import PartitionBarAlignmentDemo from "../eightstar/examples/partition-bar-alignment-demo";
import PartitionBarCustomColoursDemo from "../eightstar/examples/partition-bar-custom-colours-demo";
import PartitionBarDemo from "../eightstar/examples/partition-bar-demo";
import PartitionBarSizeDemo from "../eightstar/examples/partition-bar-size-demo";
import PartitionBarVariantsDemo from "../eightstar/examples/partition-bar-variants-demo";
import PartitionBarWidthDemo from "../eightstar/examples/partition-bar-width-demo";
import RelativeTimeDemo from "../eightstar/examples/relative-time-demo";
import TimelineDemo from "../eightstar/examples/timeline-demo";
import TimelineHollowDemo from "../eightstar/examples/timeline-hollow-demo";
import TimelineNocardsDemo from "../eightstar/examples/timeline-nocards-demo";
import TimelineNotAlternatingDemo from "../eightstar/examples/timeline-not-alternating-demo";
import TimelineVerticalDemo from "../eightstar/examples/timeline-vertical-demo";
import TransportBadgeDemoHk from "../eightstar/examples/transport-badge-demo-hk";
import TransportBadgeDemoMultiStation from "../eightstar/examples/transport-badge-demo-multi-station";
import TransportBadgeDemoSingleStation from "../eightstar/examples/transport-badge-demo-single-station";
import TransportBadgeDemoSizes from "../eightstar/examples/transport-badge-demo-sizes";
import TransportBadgeDemoStationName from "../eightstar/examples/transport-badge-demo-station-name";
import TransportBadgeDemo from "../eightstar/examples/transport-badge-demo";
import Table01 from "../blocks-so/table-01/table-01";
import Table02 from "../blocks-so/table-02/table-02";
import Table03 from "../blocks-so/table-03/table-03";
import Table04 from "../blocks-so/table-04/table-04";
import Table05 from "../blocks-so/table-05/table-05";
import Example_AvatarStackHover from "../kibo/_examples/avatar-stack-hover";
import Example_AvatarStack from "../kibo/_examples/avatar-stack";
import Example_CodeBlockDiff from "../kibo/_examples/code-block-diff";
import Example_CodeBlockFocus from "../kibo/_examples/code-block-focus";
import Example_CodeBlockHeadless from "../kibo/_examples/code-block-headless";
import Example_CodeBlockHighlightLine from "../kibo/_examples/code-block-highlight-line";
import Example_CodeBlockHighlightWord from "../kibo/_examples/code-block-highlight-word";
import Example_CodeBlockNoHighlighting from "../kibo/_examples/code-block-no-highlighting";
import Example_CodeBlockNumberless from "../kibo/_examples/code-block-numberless";
import Example_CodeBlockTheme from "../kibo/_examples/code-block-theme";
import Example_CodeBlock from "../kibo/_examples/code-block";
import Example_CodeExample from "../kibo/_examples/code-example";
import Example_ContributionGraphCustomBlocks from "../kibo/_examples/contribution-graph-custom-blocks";
import Example_ContributionGraphCustomFooter from "../kibo/_examples/contribution-graph-custom-footer";
import Example_ContributionGraphCustomTheme from "../kibo/_examples/contribution-graph-custom-theme";
import Example_ContributionGraphMinimal from "../kibo/_examples/contribution-graph-minimal";
import Example_ContributionGraphSize from "../kibo/_examples/contribution-graph-size";
import Example_ContributionGraphTooltip from "../kibo/_examples/contribution-graph-tooltip";
import Example_ContributionGraph from "../kibo/_examples/contribution-graph";
import Example_PillAvatarGroup from "../kibo/_examples/pill-avatar-group";
import Example_PillAvatar from "../kibo/_examples/pill-avatar";
import Example_PillButton from "../kibo/_examples/pill-button";
import Example_PillDelta from "../kibo/_examples/pill-delta";
import Example_PillIcon from "../kibo/_examples/pill-icon";
import Example_PillIndicator from "../kibo/_examples/pill-indicator";
import Example_PillStatus from "../kibo/_examples/pill-status";
import Example_Pill from "../kibo/_examples/pill";
import Example_QrCodeRobust from "../kibo/_examples/qr-code-robust";
import Example_QrCodeServer from "../kibo/_examples/qr-code-server";
import Example_QrCodeStyling from "../kibo/_examples/qr-code-styling";
import Example_QrCode from "../kibo/_examples/qr-code";
import Example_RelativeTimeControlled from "../kibo/_examples/relative-time-controlled";
import Example_RelativeTimeFormatDate from "../kibo/_examples/relative-time-format-date";
import Example_RelativeTimeFormatTime from "../kibo/_examples/relative-time-format-time";
import Example_RelativeTime from "../kibo/_examples/relative-time";
import Example_SnippetNpm from "../kibo/_examples/snippet-npm";
import Example_Snippet from "../kibo/_examples/snippet";
import Example_TableSimple from "../kibo/_examples/table-simple";
import Example_Table from "../kibo/_examples/table";
import Example_TickerCurrency from "../kibo/_examples/ticker-currency";
import Example_TickerInline from "../kibo/_examples/ticker-inline";
import Example_TickerPercent from "../kibo/_examples/ticker-percent";
import Example_Ticker from "../kibo/_examples/ticker";
import Example_TreeControlled from "../kibo/_examples/tree-controlled";
import Example_TreeCustomIcons from "../kibo/_examples/tree-custom-icons";
import Example_TreeNoLines from "../kibo/_examples/tree-no-lines";
import Example_TreeSimple from "../kibo/_examples/tree-simple";
import Example_Tree from "../kibo/_examples/tree";
import Example_Typography from "../kibo/_examples/typography";

const meta = { title: "Lab/Components/Data" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiTable: Story = {
  name: "table",
  render: () => (
    <StoryFrame width={560}>
      <TablePreview />
    </StoryFrame>
  ),
};

export const BeautifulDiffTable: Story = {
  name: "Diff Table",
  render: () => (
    <StoryFrame width={520}>
      <DiffTable />
    </StoryFrame>
  ),
};

export const BeautifulRecordsTable: Story = {
  name: "Records Table",
  render: () => (
    <StoryFrame width={640}>
      <RecordsTable />
    </StoryFrame>
  ),
};

export const BeautifulFilterTable: Story = {
  name: "Filter Table",
  render: () => (
    <StoryFrame width={520}>
      <FilterTable />
    </StoryFrame>
  ),
};

export const EightstarHeatmapCustomColorsDemo: Story = {
  name: "heatmap custom colors",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapCustomColorsDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapCustomDisplayDemo: Story = {
  name: "heatmap custom display",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapCustomDisplayDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapDaysOfWeekDemo: Story = {
  name: "heatmap days of week",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapDaysOfWeekDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapDemo: Story = {
  name: "heatmap",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapDisplayStyleDemo: Story = {
  name: "heatmap display style",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapDisplayStyleDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapInterpolateDemo: Story = {
  name: "heatmap interpolate",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapInterpolateDemo />
    </StoryFrame>
  ),
};

export const EightstarHeatmapSizeDemo: Story = {
  name: "heatmap size",
  render: () => (
    <StoryFrame width={640}>
      <HeatmapSizeDemo />
    </StoryFrame>
  ),
};

export const EightstarJsonViewerDemo: Story = {
  name: "json viewer",
  render: () => (
    <StoryFrame width={640}>
      <JsonViewerDemo />
    </StoryFrame>
  ),
};

export const EightstarJsonViewerFeaturesDemo: Story = {
  name: "json viewer features",
  render: () => (
    <StoryFrame width={640}>
      <JsonViewerFeaturesDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarAlignmentDemo: Story = {
  name: "partition bar alignment",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarAlignmentDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarCustomColoursDemo: Story = {
  name: "partition bar custom colours",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarCustomColoursDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarDemo: Story = {
  name: "partition bar",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarSizeDemo: Story = {
  name: "partition bar size",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarSizeDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarVariantsDemo: Story = {
  name: "partition bar variants",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarVariantsDemo />
    </StoryFrame>
  ),
};

export const EightstarPartitionBarWidthDemo: Story = {
  name: "partition bar width",
  render: () => (
    <StoryFrame width={640}>
      <PartitionBarWidthDemo />
    </StoryFrame>
  ),
};

export const EightstarRelativeTimeDemo: Story = {
  name: "relative time",
  render: () => (
    <StoryFrame width={640}>
      <RelativeTimeDemo />
    </StoryFrame>
  ),
};

export const EightstarTimelineDemo: Story = {
  name: "timeline",
  render: () => (
    <StoryFrame width={640}>
      <TimelineDemo />
    </StoryFrame>
  ),
};

export const EightstarTimelineHollowDemo: Story = {
  name: "timeline hollow",
  render: () => (
    <StoryFrame width={640}>
      <TimelineHollowDemo />
    </StoryFrame>
  ),
};

export const EightstarTimelineNocardsDemo: Story = {
  name: "timeline nocards",
  render: () => (
    <StoryFrame width={640}>
      <TimelineNocardsDemo />
    </StoryFrame>
  ),
};

export const EightstarTimelineNotAlternatingDemo: Story = {
  name: "timeline not alternating",
  render: () => (
    <StoryFrame width={640}>
      <TimelineNotAlternatingDemo />
    </StoryFrame>
  ),
};

export const EightstarTimelineVerticalDemo: Story = {
  name: "timeline vertical",
  render: () => (
    <StoryFrame width={640}>
      <TimelineVerticalDemo />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemoHk: Story = {
  name: "transport badge hk",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemoHk />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemoMultiStation: Story = {
  name: "transport badge multi station",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemoMultiStation />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemoSingleStation: Story = {
  name: "transport badge single station",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemoSingleStation />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemoSizes: Story = {
  name: "transport badge sizes",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemoSizes />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemoStationName: Story = {
  name: "transport badge station name",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemoStationName />
    </StoryFrame>
  ),
};

export const EightstarTransportBadgeDemo: Story = {
  name: "transport badge",
  render: () => (
    <StoryFrame width={640}>
      <TransportBadgeDemo />
    </StoryFrame>
  ),
};

export const BlockTable01: Story = {
  name: "table-01",
  render: () => (
    <StoryFrame width={720}>
      <Table01 />
    </StoryFrame>
  ),
};

export const BlockTable02: Story = {
  name: "table-02",
  render: () => (
    <StoryFrame width={720}>
      <Table02 />
    </StoryFrame>
  ),
};

export const BlockTable03: Story = {
  name: "table-03",
  render: () => (
    <StoryFrame width={720}>
      <Table03 />
    </StoryFrame>
  ),
};

export const BlockTable04: Story = {
  name: "table-04",
  render: () => (
    <StoryFrame width={720}>
      <Table04 />
    </StoryFrame>
  ),
};

export const BlockTable05: Story = {
  name: "table-05",
  render: () => (
    <StoryFrame width={720}>
      <Table05 />
    </StoryFrame>
  ),
};

export const KiboAvatarStackHover: Story = {
  name: "avatar stack hover",
  render: () => (
    <StoryFrame width={720}>
      <Example_AvatarStackHover />
    </StoryFrame>
  ),
};

export const KiboAvatarStack: Story = {
  name: "avatar stack",
  render: () => (
    <StoryFrame width={720}>
      <Example_AvatarStack />
    </StoryFrame>
  ),
};

export const KiboCodeBlockDiff: Story = {
  name: "code block diff",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockDiff />
    </StoryFrame>
  ),
};

export const KiboCodeBlockFocus: Story = {
  name: "code block focus",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockFocus />
    </StoryFrame>
  ),
};

export const KiboCodeBlockHeadless: Story = {
  name: "code block headless",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockHeadless />
    </StoryFrame>
  ),
};

export const KiboCodeBlockHighlightLine: Story = {
  name: "code block highlight line",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockHighlightLine />
    </StoryFrame>
  ),
};

export const KiboCodeBlockHighlightWord: Story = {
  name: "code block highlight word",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockHighlightWord />
    </StoryFrame>
  ),
};

export const KiboCodeBlockNoHighlighting: Story = {
  name: "code block no highlighting",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockNoHighlighting />
    </StoryFrame>
  ),
};

export const KiboCodeBlockNumberless: Story = {
  name: "code block numberless",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockNumberless />
    </StoryFrame>
  ),
};

export const KiboCodeBlockTheme: Story = {
  name: "code block theme",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlockTheme />
    </StoryFrame>
  ),
};

export const KiboCodeBlock: Story = {
  name: "code block",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeBlock />
    </StoryFrame>
  ),
};

export const KiboCodeExample: Story = {
  name: "code example",
  render: () => (
    <StoryFrame width={720}>
      <Example_CodeExample />
    </StoryFrame>
  ),
};

export const KiboContributionGraphCustomBlocks: Story = {
  name: "contribution graph custom blocks",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphCustomBlocks />
    </StoryFrame>
  ),
};

export const KiboContributionGraphCustomFooter: Story = {
  name: "contribution graph custom footer",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphCustomFooter />
    </StoryFrame>
  ),
};

export const KiboContributionGraphCustomTheme: Story = {
  name: "contribution graph custom theme",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphCustomTheme />
    </StoryFrame>
  ),
};

export const KiboContributionGraphMinimal: Story = {
  name: "contribution graph minimal",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphMinimal />
    </StoryFrame>
  ),
};

export const KiboContributionGraphSize: Story = {
  name: "contribution graph size",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphSize />
    </StoryFrame>
  ),
};

export const KiboContributionGraphTooltip: Story = {
  name: "contribution graph tooltip",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraphTooltip />
    </StoryFrame>
  ),
};

export const KiboContributionGraph: Story = {
  name: "contribution graph",
  render: () => (
    <StoryFrame width={720}>
      <Example_ContributionGraph />
    </StoryFrame>
  ),
};

export const KiboPillAvatarGroup: Story = {
  name: "pill avatar group",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillAvatarGroup />
    </StoryFrame>
  ),
};

export const KiboPillAvatar: Story = {
  name: "pill avatar",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillAvatar />
    </StoryFrame>
  ),
};

export const KiboPillButton: Story = {
  name: "pill button",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillButton />
    </StoryFrame>
  ),
};

export const KiboPillDelta: Story = {
  name: "pill delta",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillDelta />
    </StoryFrame>
  ),
};

export const KiboPillIcon: Story = {
  name: "pill icon",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillIcon />
    </StoryFrame>
  ),
};

export const KiboPillIndicator: Story = {
  name: "pill indicator",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillIndicator />
    </StoryFrame>
  ),
};

export const KiboPillStatus: Story = {
  name: "pill status",
  render: () => (
    <StoryFrame width={720}>
      <Example_PillStatus />
    </StoryFrame>
  ),
};

export const KiboPill: Story = {
  name: "pill",
  render: () => (
    <StoryFrame width={720}>
      <Example_Pill />
    </StoryFrame>
  ),
};

export const KiboQrCodeRobust: Story = {
  name: "qr code robust",
  render: () => (
    <StoryFrame width={720}>
      <Example_QrCodeRobust />
    </StoryFrame>
  ),
};

export const KiboQrCodeServer: Story = {
  name: "qr code server",
  render: () => (
    <StoryFrame width={720}>
      <Example_QrCodeServer />
    </StoryFrame>
  ),
};

export const KiboQrCodeStyling: Story = {
  name: "qr code styling",
  render: () => (
    <StoryFrame width={720}>
      <Example_QrCodeStyling />
    </StoryFrame>
  ),
};

export const KiboQrCode: Story = {
  name: "qr code",
  render: () => (
    <StoryFrame width={720}>
      <Example_QrCode />
    </StoryFrame>
  ),
};

export const KiboRelativeTimeControlled: Story = {
  name: "relative time controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_RelativeTimeControlled />
    </StoryFrame>
  ),
};

export const KiboRelativeTimeFormatDate: Story = {
  name: "relative time format date",
  render: () => (
    <StoryFrame width={720}>
      <Example_RelativeTimeFormatDate />
    </StoryFrame>
  ),
};

export const KiboRelativeTimeFormatTime: Story = {
  name: "relative time format time",
  render: () => (
    <StoryFrame width={720}>
      <Example_RelativeTimeFormatTime />
    </StoryFrame>
  ),
};

export const KiboRelativeTime: Story = {
  name: "relative time",
  render: () => (
    <StoryFrame width={720}>
      <Example_RelativeTime />
    </StoryFrame>
  ),
};

export const KiboSnippetNpm: Story = {
  name: "snippet npm",
  render: () => (
    <StoryFrame width={720}>
      <Example_SnippetNpm />
    </StoryFrame>
  ),
};

export const KiboSnippet: Story = {
  name: "snippet",
  render: () => (
    <StoryFrame width={720}>
      <Example_Snippet />
    </StoryFrame>
  ),
};

export const KiboTableSimple: Story = {
  name: "table simple",
  render: () => (
    <StoryFrame width={720}>
      <Example_TableSimple />
    </StoryFrame>
  ),
};

export const KiboTable: Story = {
  name: "table",
  render: () => (
    <StoryFrame width={720}>
      <Example_Table />
    </StoryFrame>
  ),
};

export const KiboTickerCurrency: Story = {
  name: "ticker currency",
  render: () => (
    <StoryFrame width={720}>
      <Example_TickerCurrency />
    </StoryFrame>
  ),
};

export const KiboTickerInline: Story = {
  name: "ticker inline",
  render: () => (
    <StoryFrame width={720}>
      <Example_TickerInline />
    </StoryFrame>
  ),
};

export const KiboTickerPercent: Story = {
  name: "ticker percent",
  render: () => (
    <StoryFrame width={720}>
      <Example_TickerPercent />
    </StoryFrame>
  ),
};

export const KiboTicker: Story = {
  name: "ticker",
  render: () => (
    <StoryFrame width={720}>
      <Example_Ticker />
    </StoryFrame>
  ),
};

export const KiboTreeControlled: Story = {
  name: "tree controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_TreeControlled />
    </StoryFrame>
  ),
};

export const KiboTreeCustomIcons: Story = {
  name: "tree custom icons",
  render: () => (
    <StoryFrame width={720}>
      <Example_TreeCustomIcons />
    </StoryFrame>
  ),
};

export const KiboTreeNoLines: Story = {
  name: "tree no lines",
  render: () => (
    <StoryFrame width={720}>
      <Example_TreeNoLines />
    </StoryFrame>
  ),
};

export const KiboTreeSimple: Story = {
  name: "tree simple",
  render: () => (
    <StoryFrame width={720}>
      <Example_TreeSimple />
    </StoryFrame>
  ),
};

export const KiboTree: Story = {
  name: "tree",
  render: () => (
    <StoryFrame width={720}>
      <Example_Tree />
    </StoryFrame>
  ),
};

export const KiboTypography: Story = {
  name: "typography",
  render: () => (
    <StoryFrame width={720}>
      <Example_Typography />
    </StoryFrame>
  ),
};
