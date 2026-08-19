import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import FlipClockCountdownDemo from "../eightstar/examples/flip-clock-countdown-demo";
import FlipClockDemo from "../eightstar/examples/flip-clock-demo";
import FlipClockShowdaysDemo from "../eightstar/examples/flip-clock-showdays-demo";
import FlipClockSizeDemo from "../eightstar/examples/flip-clock-size-demo";
import FlipClockVariantsDemo from "../eightstar/examples/flip-clock-variants-demo";
import MarqueeDemo from "../eightstar/examples/marquee-demo";
import MarqueeGrayscaleDemo from "../eightstar/examples/marquee-grayscale-demo";
import MarqueeGreyscaleDemo from "../eightstar/examples/marquee-greyscale-demo";
import MarqueeReverseDemo from "../eightstar/examples/marquee-reverse-demo";
import VideoPlayerAutoDemo from "../eightstar/examples/video-player-auto-demo";
import VideoPlayerDemo from "../eightstar/examples/video-player-demo";
import VideoPlayerFitDemo from "../eightstar/examples/video-player-fit-demo";
import VideoPlayerHideCenterControlsDemo from "../eightstar/examples/video-player-hide-center-controls-demo";
import VideoPlayerMinimalControlsDemo from "../eightstar/examples/video-player-minimal-controls-demo";
import VideoPlayerRepeatDemo from "../eightstar/examples/video-player-repeat-demo";
import VideoPlayerSizingDemo from "../eightstar/examples/video-player-sizing-demo";
import VideoPlayerVisibleControlsDemo from "../eightstar/examples/video-player-visible-controls-demo";
import Example_Compare from "../kibo/_examples/compare";
import Example_ComparisonEventHandlers from "../kibo/_examples/comparison-event-handlers";
import Example_ComparisonHover from "../kibo/_examples/comparison-hover";
import Example_Comparison from "../kibo/_examples/comparison";
import Example_DeckControlled from "../kibo/_examples/deck-controlled";
import Example_DeckProductCards from "../kibo/_examples/deck-product-cards";
import Example_Deck from "../kibo/_examples/deck";
import Example_ImageZoomBackground from "../kibo/_examples/image-zoom-background";
import Example_ImageZoomMargin from "../kibo/_examples/image-zoom-margin";
import Example_ImageZoom from "../kibo/_examples/image-zoom";
import Example_MarqueeNoFade from "../kibo/_examples/marquee-no-fade";
import Example_MarqueeRaw from "../kibo/_examples/marquee-raw";
import Example_MarqueeSpacing from "../kibo/_examples/marquee-spacing";
import Example_Marquee from "../kibo/_examples/marquee";
import Example_ReelCustom from "../kibo/_examples/reel-custom";
import Example_ReelImages from "../kibo/_examples/reel-images";
import Example_ReelMinimal from "../kibo/_examples/reel-minimal";
import Example_Reel from "../kibo/_examples/reel";
import Example_StoriesAvatars from "../kibo/_examples/stories-avatars";
import Example_StoriesImages from "../kibo/_examples/stories-images";
import Example_Stories from "../kibo/_examples/stories";
import Example_VideoPlayer from "../kibo/_examples/video-player";

const meta = { title: "Lab/Components/Media" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const EightstarFlipClockCountdownDemo: Story = {
  name: "flip clock countdown",
  render: () => (
    <StoryFrame width={640}>
      <FlipClockCountdownDemo />
    </StoryFrame>
  ),
};

export const EightstarFlipClockDemo: Story = {
  name: "flip clock",
  render: () => (
    <StoryFrame width={640}>
      <FlipClockDemo />
    </StoryFrame>
  ),
};

export const EightstarFlipClockShowdaysDemo: Story = {
  name: "flip clock showdays",
  render: () => (
    <StoryFrame width={640}>
      <FlipClockShowdaysDemo />
    </StoryFrame>
  ),
};

export const EightstarFlipClockSizeDemo: Story = {
  name: "flip clock size",
  render: () => (
    <StoryFrame width={640}>
      <FlipClockSizeDemo />
    </StoryFrame>
  ),
};

export const EightstarFlipClockVariantsDemo: Story = {
  name: "flip clock variants",
  render: () => (
    <StoryFrame width={640}>
      <FlipClockVariantsDemo />
    </StoryFrame>
  ),
};

export const EightstarMarqueeDemo: Story = {
  name: "marquee",
  render: () => (
    <StoryFrame width={640}>
      <MarqueeDemo />
    </StoryFrame>
  ),
};

export const EightstarMarqueeGrayscaleDemo: Story = {
  name: "marquee grayscale",
  render: () => (
    <StoryFrame width={640}>
      <MarqueeGrayscaleDemo />
    </StoryFrame>
  ),
};

export const EightstarMarqueeGreyscaleDemo: Story = {
  name: "marquee greyscale",
  render: () => (
    <StoryFrame width={640}>
      <MarqueeGreyscaleDemo />
    </StoryFrame>
  ),
};

export const EightstarMarqueeReverseDemo: Story = {
  name: "marquee reverse",
  render: () => (
    <StoryFrame width={640}>
      <MarqueeReverseDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerAutoDemo: Story = {
  name: "video player auto",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerAutoDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerDemo: Story = {
  name: "video player",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerFitDemo: Story = {
  name: "video player fit",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerFitDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerHideCenterControlsDemo: Story = {
  name: "video player hide center controls",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerHideCenterControlsDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerMinimalControlsDemo: Story = {
  name: "video player minimal controls",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerMinimalControlsDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerRepeatDemo: Story = {
  name: "video player repeat",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerRepeatDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerSizingDemo: Story = {
  name: "video player sizing",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerSizingDemo />
    </StoryFrame>
  ),
};

export const EightstarVideoPlayerVisibleControlsDemo: Story = {
  name: "video player visible controls",
  render: () => (
    <StoryFrame width={640}>
      <VideoPlayerVisibleControlsDemo />
    </StoryFrame>
  ),
};

export const KiboCompare: Story = {
  name: "compare",
  render: () => (
    <StoryFrame width={720}>
      <Example_Compare />
    </StoryFrame>
  ),
};

export const KiboComparisonEventHandlers: Story = {
  name: "comparison event handlers",
  render: () => (
    <StoryFrame width={720}>
      <Example_ComparisonEventHandlers />
    </StoryFrame>
  ),
};

export const KiboComparisonHover: Story = {
  name: "comparison hover",
  render: () => (
    <StoryFrame width={720}>
      <Example_ComparisonHover />
    </StoryFrame>
  ),
};

export const KiboComparison: Story = {
  name: "comparison",
  render: () => (
    <StoryFrame width={720}>
      <Example_Comparison />
    </StoryFrame>
  ),
};

export const KiboDeckControlled: Story = {
  name: "deck controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_DeckControlled />
    </StoryFrame>
  ),
};

export const KiboDeckProductCards: Story = {
  name: "deck product cards",
  render: () => (
    <StoryFrame width={720}>
      <Example_DeckProductCards />
    </StoryFrame>
  ),
};

export const KiboDeck: Story = {
  name: "deck",
  render: () => (
    <StoryFrame width={720}>
      <Example_Deck />
    </StoryFrame>
  ),
};

export const KiboImageZoomBackground: Story = {
  name: "image zoom background",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageZoomBackground />
    </StoryFrame>
  ),
};

export const KiboImageZoomMargin: Story = {
  name: "image zoom margin",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageZoomMargin />
    </StoryFrame>
  ),
};

export const KiboImageZoom: Story = {
  name: "image zoom",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageZoom />
    </StoryFrame>
  ),
};

export const KiboMarqueeNoFade: Story = {
  name: "marquee no fade",
  render: () => (
    <StoryFrame width={720}>
      <Example_MarqueeNoFade />
    </StoryFrame>
  ),
};

export const KiboMarqueeRaw: Story = {
  name: "marquee raw",
  render: () => (
    <StoryFrame width={720}>
      <Example_MarqueeRaw />
    </StoryFrame>
  ),
};

export const KiboMarqueeSpacing: Story = {
  name: "marquee spacing",
  render: () => (
    <StoryFrame width={720}>
      <Example_MarqueeSpacing />
    </StoryFrame>
  ),
};

export const KiboMarquee: Story = {
  name: "marquee",
  render: () => (
    <StoryFrame width={720}>
      <Example_Marquee />
    </StoryFrame>
  ),
};

export const KiboReelCustom: Story = {
  name: "reel custom",
  render: () => (
    <StoryFrame width={720}>
      <Example_ReelCustom />
    </StoryFrame>
  ),
};

export const KiboReelImages: Story = {
  name: "reel images",
  render: () => (
    <StoryFrame width={720}>
      <Example_ReelImages />
    </StoryFrame>
  ),
};

export const KiboReelMinimal: Story = {
  name: "reel minimal",
  render: () => (
    <StoryFrame width={720}>
      <Example_ReelMinimal />
    </StoryFrame>
  ),
};

export const KiboReel: Story = {
  name: "reel",
  render: () => (
    <StoryFrame width={720}>
      <Example_Reel />
    </StoryFrame>
  ),
};

export const KiboStoriesAvatars: Story = {
  name: "stories avatars",
  render: () => (
    <StoryFrame width={720}>
      <Example_StoriesAvatars />
    </StoryFrame>
  ),
};

export const KiboStoriesImages: Story = {
  name: "stories images",
  render: () => (
    <StoryFrame width={720}>
      <Example_StoriesImages />
    </StoryFrame>
  ),
};

export const KiboStories: Story = {
  name: "stories",
  render: () => (
    <StoryFrame width={720}>
      <Example_Stories />
    </StoryFrame>
  ),
};

export const KiboVideoPlayer: Story = {
  name: "video player",
  render: () => (
    <StoryFrame width={720}>
      <Example_VideoPlayer />
    </StoryFrame>
  ),
};
