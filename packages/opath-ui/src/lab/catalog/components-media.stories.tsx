import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const FlipClockCountdownDemo = lazy(() => import("../eightstar/examples/flip-clock-countdown-demo").then((m) => ({ default: m.default ?? m.FlipClockCountdownDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const FlipClockDemo = lazy(() => import("../eightstar/examples/flip-clock-demo").then((m) => ({ default: m.default ?? m.FlipClockDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const FlipClockShowdaysDemo = lazy(() => import("../eightstar/examples/flip-clock-showdays-demo").then((m) => ({ default: m.default ?? m.FlipClockShowdaysDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const FlipClockSizeDemo = lazy(() => import("../eightstar/examples/flip-clock-size-demo").then((m) => ({ default: m.default ?? m.FlipClockSizeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const FlipClockVariantsDemo = lazy(() => import("../eightstar/examples/flip-clock-variants-demo").then((m) => ({ default: m.default ?? m.FlipClockVariantsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const MarqueeDemo = lazy(() => import("../eightstar/examples/marquee-demo").then((m) => ({ default: m.default ?? m.MarqueeDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const MarqueeGrayscaleDemo = lazy(() => import("../eightstar/examples/marquee-grayscale-demo").then((m) => ({ default: m.default ?? m.MarqueeGrayscaleDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const MarqueeGreyscaleDemo = lazy(() => import("../eightstar/examples/marquee-greyscale-demo").then((m) => ({ default: m.default ?? m.MarqueeGreyscaleDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const MarqueeReverseDemo = lazy(() => import("../eightstar/examples/marquee-reverse-demo").then((m) => ({ default: m.default ?? m.MarqueeReverseDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerAutoDemo = lazy(() => import("../eightstar/examples/video-player-auto-demo").then((m) => ({ default: m.default ?? m.VideoPlayerAutoDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerDemo = lazy(() => import("../eightstar/examples/video-player-demo").then((m) => ({ default: m.default ?? m.VideoPlayerDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerFitDemo = lazy(() => import("../eightstar/examples/video-player-fit-demo").then((m) => ({ default: m.default ?? m.VideoPlayerFitDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerHideCenterControlsDemo = lazy(() => import("../eightstar/examples/video-player-hide-center-controls-demo").then((m) => ({ default: m.default ?? m.VideoPlayerHideCenterControlsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerMinimalControlsDemo = lazy(() => import("../eightstar/examples/video-player-minimal-controls-demo").then((m) => ({ default: m.default ?? m.VideoPlayerMinimalControlsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerRepeatDemo = lazy(() => import("../eightstar/examples/video-player-repeat-demo").then((m) => ({ default: m.default ?? m.VideoPlayerRepeatDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerSizingDemo = lazy(() => import("../eightstar/examples/video-player-sizing-demo").then((m) => ({ default: m.default ?? m.VideoPlayerSizingDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const VideoPlayerVisibleControlsDemo = lazy(() => import("../eightstar/examples/video-player-visible-controls-demo").then((m) => ({ default: m.default ?? m.VideoPlayerVisibleControlsDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Compare = lazy(() => import("../kibo/_examples/compare").then((m) => ({ default: m.default ?? m.Example_Compare ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ComparisonEventHandlers = lazy(() => import("../kibo/_examples/comparison-event-handlers").then((m) => ({ default: m.default ?? m.Example_ComparisonEventHandlers ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ComparisonHover = lazy(() => import("../kibo/_examples/comparison-hover").then((m) => ({ default: m.default ?? m.Example_ComparisonHover ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Comparison = lazy(() => import("../kibo/_examples/comparison").then((m) => ({ default: m.default ?? m.Example_Comparison ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DeckControlled = lazy(() => import("../kibo/_examples/deck-controlled").then((m) => ({ default: m.default ?? m.Example_DeckControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DeckProductCards = lazy(() => import("../kibo/_examples/deck-product-cards").then((m) => ({ default: m.default ?? m.Example_DeckProductCards ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Deck = lazy(() => import("../kibo/_examples/deck").then((m) => ({ default: m.default ?? m.Example_Deck ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageZoomBackground = lazy(() => import("../kibo/_examples/image-zoom-background").then((m) => ({ default: m.default ?? m.Example_ImageZoomBackground ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageZoomMargin = lazy(() => import("../kibo/_examples/image-zoom-margin").then((m) => ({ default: m.default ?? m.Example_ImageZoomMargin ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageZoom = lazy(() => import("../kibo/_examples/image-zoom").then((m) => ({ default: m.default ?? m.Example_ImageZoom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MarqueeNoFade = lazy(() => import("../kibo/_examples/marquee-no-fade").then((m) => ({ default: m.default ?? m.Example_MarqueeNoFade ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MarqueeRaw = lazy(() => import("../kibo/_examples/marquee-raw").then((m) => ({ default: m.default ?? m.Example_MarqueeRaw ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MarqueeSpacing = lazy(() => import("../kibo/_examples/marquee-spacing").then((m) => ({ default: m.default ?? m.Example_MarqueeSpacing ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Marquee = lazy(() => import("../kibo/_examples/marquee").then((m) => ({ default: m.default ?? m.Example_Marquee ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ReelCustom = lazy(() => import("../kibo/_examples/reel-custom").then((m) => ({ default: m.default ?? m.Example_ReelCustom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ReelImages = lazy(() => import("../kibo/_examples/reel-images").then((m) => ({ default: m.default ?? m.Example_ReelImages ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ReelMinimal = lazy(() => import("../kibo/_examples/reel-minimal").then((m) => ({ default: m.default ?? m.Example_ReelMinimal ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Reel = lazy(() => import("../kibo/_examples/reel").then((m) => ({ default: m.default ?? m.Example_Reel ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_StoriesAvatars = lazy(() => import("../kibo/_examples/stories-avatars").then((m) => ({ default: m.default ?? m.Example_StoriesAvatars ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_StoriesImages = lazy(() => import("../kibo/_examples/stories-images").then((m) => ({ default: m.default ?? m.Example_StoriesImages ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Stories = lazy(() => import("../kibo/_examples/stories").then((m) => ({ default: m.default ?? m.Example_Stories ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_VideoPlayer = lazy(() => import("../kibo/_examples/video-player").then((m) => ({ default: m.default ?? m.Example_VideoPlayer ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Media" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const EightstarFlipClockCountdownDemo: Story = {
  name: "flip clock countdown",
  render: () => (
    <LazyFrame width={640}>
      <FlipClockCountdownDemo />
    </LazyFrame>
  ),
};

export const EightstarFlipClockDemo: Story = {
  name: "flip clock",
  render: () => (
    <LazyFrame width={640}>
      <FlipClockDemo />
    </LazyFrame>
  ),
};

export const EightstarFlipClockShowdaysDemo: Story = {
  name: "flip clock showdays",
  render: () => (
    <LazyFrame width={640}>
      <FlipClockShowdaysDemo />
    </LazyFrame>
  ),
};

export const EightstarFlipClockSizeDemo: Story = {
  name: "flip clock size",
  render: () => (
    <LazyFrame width={640}>
      <FlipClockSizeDemo />
    </LazyFrame>
  ),
};

export const EightstarFlipClockVariantsDemo: Story = {
  name: "flip clock variants",
  render: () => (
    <LazyFrame width={640}>
      <FlipClockVariantsDemo />
    </LazyFrame>
  ),
};

export const EightstarMarqueeDemo: Story = {
  name: "marquee",
  render: () => (
    <LazyFrame width={640}>
      <MarqueeDemo />
    </LazyFrame>
  ),
};

export const EightstarMarqueeGrayscaleDemo: Story = {
  name: "marquee grayscale",
  render: () => (
    <LazyFrame width={640}>
      <MarqueeGrayscaleDemo />
    </LazyFrame>
  ),
};

export const EightstarMarqueeGreyscaleDemo: Story = {
  name: "marquee greyscale",
  render: () => (
    <LazyFrame width={640}>
      <MarqueeGreyscaleDemo />
    </LazyFrame>
  ),
};

export const EightstarMarqueeReverseDemo: Story = {
  name: "marquee reverse",
  render: () => (
    <LazyFrame width={640}>
      <MarqueeReverseDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerAutoDemo: Story = {
  name: "video player auto",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerAutoDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerDemo: Story = {
  name: "video player",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerFitDemo: Story = {
  name: "video player fit",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerFitDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerHideCenterControlsDemo: Story = {
  name: "video player hide center controls",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerHideCenterControlsDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerMinimalControlsDemo: Story = {
  name: "video player minimal controls",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerMinimalControlsDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerRepeatDemo: Story = {
  name: "video player repeat",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerRepeatDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerSizingDemo: Story = {
  name: "video player sizing",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerSizingDemo />
    </LazyFrame>
  ),
};

export const EightstarVideoPlayerVisibleControlsDemo: Story = {
  name: "video player visible controls",
  render: () => (
    <LazyFrame width={640}>
      <VideoPlayerVisibleControlsDemo />
    </LazyFrame>
  ),
};

export const KiboCompare: Story = {
  name: "compare",
  render: () => (
    <LazyFrame width={720}>
      <Example_Compare />
    </LazyFrame>
  ),
};

export const KiboComparisonEventHandlers: Story = {
  name: "comparison event handlers",
  render: () => (
    <LazyFrame width={720}>
      <Example_ComparisonEventHandlers />
    </LazyFrame>
  ),
};

export const KiboComparisonHover: Story = {
  name: "comparison hover",
  render: () => (
    <LazyFrame width={720}>
      <Example_ComparisonHover />
    </LazyFrame>
  ),
};

export const KiboComparison: Story = {
  name: "comparison",
  render: () => (
    <LazyFrame width={720}>
      <Example_Comparison />
    </LazyFrame>
  ),
};

export const KiboDeckControlled: Story = {
  name: "deck controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_DeckControlled />
    </LazyFrame>
  ),
};

export const KiboDeckProductCards: Story = {
  name: "deck product cards",
  render: () => (
    <LazyFrame width={720}>
      <Example_DeckProductCards />
    </LazyFrame>
  ),
};

export const KiboDeck: Story = {
  name: "deck",
  render: () => (
    <LazyFrame width={720}>
      <Example_Deck />
    </LazyFrame>
  ),
};

export const KiboImageZoomBackground: Story = {
  name: "image zoom background",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageZoomBackground />
    </LazyFrame>
  ),
};

export const KiboImageZoomMargin: Story = {
  name: "image zoom margin",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageZoomMargin />
    </LazyFrame>
  ),
};

export const KiboImageZoom: Story = {
  name: "image zoom",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageZoom />
    </LazyFrame>
  ),
};

export const KiboMarqueeNoFade: Story = {
  name: "marquee no fade",
  render: () => (
    <LazyFrame width={720}>
      <Example_MarqueeNoFade />
    </LazyFrame>
  ),
};

export const KiboMarqueeRaw: Story = {
  name: "marquee raw",
  render: () => (
    <LazyFrame width={720}>
      <Example_MarqueeRaw />
    </LazyFrame>
  ),
};

export const KiboMarqueeSpacing: Story = {
  name: "marquee spacing",
  render: () => (
    <LazyFrame width={720}>
      <Example_MarqueeSpacing />
    </LazyFrame>
  ),
};

export const KiboMarquee: Story = {
  name: "marquee",
  render: () => (
    <LazyFrame width={720}>
      <Example_Marquee />
    </LazyFrame>
  ),
};

export const KiboReelCustom: Story = {
  name: "reel custom",
  render: () => (
    <LazyFrame width={720}>
      <Example_ReelCustom />
    </LazyFrame>
  ),
};

export const KiboReelImages: Story = {
  name: "reel images",
  render: () => (
    <LazyFrame width={720}>
      <Example_ReelImages />
    </LazyFrame>
  ),
};

export const KiboReelMinimal: Story = {
  name: "reel minimal",
  render: () => (
    <LazyFrame width={720}>
      <Example_ReelMinimal />
    </LazyFrame>
  ),
};

export const KiboReel: Story = {
  name: "reel",
  render: () => (
    <LazyFrame width={720}>
      <Example_Reel />
    </LazyFrame>
  ),
};

export const KiboStoriesAvatars: Story = {
  name: "stories avatars",
  render: () => (
    <LazyFrame width={720}>
      <Example_StoriesAvatars />
    </LazyFrame>
  ),
};

export const KiboStoriesImages: Story = {
  name: "stories images",
  render: () => (
    <LazyFrame width={720}>
      <Example_StoriesImages />
    </LazyFrame>
  ),
};

export const KiboStories: Story = {
  name: "stories",
  render: () => (
    <LazyFrame width={720}>
      <Example_Stories />
    </LazyFrame>
  ),
};

export const KiboVideoPlayer: Story = {
  name: "video player",
  render: () => (
    <LazyFrame width={720}>
      <Example_VideoPlayer />
    </LazyFrame>
  ),
};
