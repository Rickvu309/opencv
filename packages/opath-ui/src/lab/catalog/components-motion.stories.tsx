import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { BouncyAccordionPreview } from "../beui/previews/bouncy-accordion.preview";
import { CylinderCarouselPreview } from "../beui/previews/cylinder-carousel.preview";
import { MarqueePreview } from "../beui/previews/marquee.preview";
import { NumberPreview } from "../beui/previews/number.preview";
import { PullToRefreshPreview } from "../beui/previews/pull-to-refresh.preview";
import { ShaderBackgroundPreview } from "../beui/previews/shader-background.preview";
import { SharedLayoutBgPreview } from "../beui/previews/shared-layout-bg.preview";
import { TextAnimationPreview } from "../beui/previews/text-animation.preview";
import { ThemeTogglePreview } from "../beui/previews/theme-toggle.preview";
import { TiltCardPreview } from "../beui/previews/tilt-card.preview";
import { Accordion as AccordionDemo } from "../transitions/accordion";
import { AvatarGroupHover as AvatarGroupHoverDemo } from "../transitions/avatar-group-hover";
import { CardResize as CardResizeDemo } from "../transitions/card-resize";
import { CardTilt as CardTiltDemo } from "../transitions/card-tilt";
import { CheckboxCheck as CheckboxCheckDemo } from "../transitions/checkbox-check";
import { ErrorStateShake as ErrorStateShakeDemo } from "../transitions/error-state-shake";
import { IconSwap as IconSwapDemo } from "../transitions/icon-swap";
import { InputClearDissolve as InputClearDissolveDemo } from "../transitions/input-clear-dissolve";
import { LearnMoreHover as LearnMoreHoverDemo } from "../transitions/learn-more-hover";
import { LikeButton as LikeButtonDemo } from "../transitions/like-button";
import { MenuDropdown as MenuDropdownDemo } from "../transitions/menu-dropdown";
import { Modal as ModalDemo } from "../transitions/modal";
import { NotificationBadge as NotificationBadgeDemo } from "../transitions/notification-badge";
import { NumberPopIn as NumberPopInDemo } from "../transitions/number-pop-in";
import { PageSideBySide as PageSideBySideDemo } from "../transitions/page-side-by-side";
import { PanelReveal as PanelRevealDemo } from "../transitions/panel-reveal";
import { PlusMenuMorph as PlusMenuMorphDemo } from "../transitions/plus-menu-morph";
import { ShimmerText as ShimmerTextDemo } from "../transitions/shimmer-text";
import { SkeletonReveal as SkeletonRevealDemo } from "../transitions/skeleton-reveal";
import { SpinningCounter as SpinningCounterDemo } from "../transitions/spinning-counter";
import { SuccessCheck as SuccessCheckDemo } from "../transitions/success-check";
import { TabsSliding as TabsSlidingDemo } from "../transitions/tabs-sliding";
import { TextStatesSwap as TextStatesSwapDemo } from "../transitions/text-states-swap";
import { TextsReveal as TextsRevealDemo } from "../transitions/texts-reveal";
import { Toast as ToastDemo } from "../transitions/toast";
import { Toggle as ToggleDemo } from "../transitions/toggle";
import { Tooltip as TooltipDemo } from "../transitions/tooltip";

const meta = { title: "Lab/Components/Motion" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiBouncyAccordion: Story = {
  name: "bouncy accordion",
  render: () => (
    <StoryFrame width={560}>
      <BouncyAccordionPreview />
    </StoryFrame>
  ),
};

export const BeuiCylinderCarousel: Story = {
  name: "cylinder carousel",
  render: () => (
    <StoryFrame width={560}>
      <CylinderCarouselPreview />
    </StoryFrame>
  ),
};

export const BeuiMarquee: Story = {
  name: "marquee",
  render: () => (
    <StoryFrame width={560}>
      <MarqueePreview />
    </StoryFrame>
  ),
};

export const BeuiNumber: Story = {
  name: "number",
  render: () => (
    <StoryFrame width={560}>
      <NumberPreview />
    </StoryFrame>
  ),
};

export const BeuiPullToRefresh: Story = {
  name: "pull to refresh",
  render: () => (
    <StoryFrame width={560}>
      <PullToRefreshPreview />
    </StoryFrame>
  ),
};

export const BeuiShaderBackground: Story = {
  name: "shader background",
  render: () => (
    <StoryFrame width={560}>
      <ShaderBackgroundPreview />
    </StoryFrame>
  ),
};

export const BeuiSharedLayoutBg: Story = {
  name: "shared layout bg",
  render: () => (
    <StoryFrame width={560}>
      <SharedLayoutBgPreview />
    </StoryFrame>
  ),
};

export const BeuiTextAnimation: Story = {
  name: "text animation",
  render: () => (
    <StoryFrame width={560}>
      <TextAnimationPreview />
    </StoryFrame>
  ),
};

export const BeuiThemeToggle: Story = {
  name: "theme toggle",
  render: () => (
    <StoryFrame width={560}>
      <ThemeTogglePreview />
    </StoryFrame>
  ),
};

export const BeuiTiltCard: Story = {
  name: "tilt card",
  render: () => (
    <StoryFrame width={560}>
      <TiltCardPreview />
    </StoryFrame>
  ),
};

export const TransitionAccordion: Story = {
  name: "accordion",
  render: () => (
    <StoryFrame width={480}>
      <AccordionDemo />
    </StoryFrame>
  ),
};

export const TransitionAvatarGroupHover: Story = {
  name: "avatar group hover",
  render: () => (
    <StoryFrame width={480}>
      <AvatarGroupHoverDemo />
    </StoryFrame>
  ),
};

export const TransitionCardResize: Story = {
  name: "card resize",
  render: () => (
    <StoryFrame width={480}>
      <CardResizeDemo />
    </StoryFrame>
  ),
};

export const TransitionCardTilt: Story = {
  name: "card tilt",
  render: () => (
    <StoryFrame width={480}>
      <CardTiltDemo />
    </StoryFrame>
  ),
};

export const TransitionCheckboxCheck: Story = {
  name: "checkbox check",
  render: () => (
    <StoryFrame width={480}>
      <CheckboxCheckDemo />
    </StoryFrame>
  ),
};

export const TransitionErrorStateShake: Story = {
  name: "error state shake",
  render: () => (
    <StoryFrame width={480}>
      <ErrorStateShakeDemo />
    </StoryFrame>
  ),
};

export const TransitionIconSwap: Story = {
  name: "icon swap",
  render: () => (
    <StoryFrame width={480}>
      <IconSwapDemo />
    </StoryFrame>
  ),
};

export const TransitionInputClearDissolve: Story = {
  name: "input clear dissolve",
  render: () => (
    <StoryFrame width={480}>
      <InputClearDissolveDemo />
    </StoryFrame>
  ),
};

export const TransitionLearnMoreHover: Story = {
  name: "learn more hover",
  render: () => (
    <StoryFrame width={480}>
      <LearnMoreHoverDemo />
    </StoryFrame>
  ),
};

export const TransitionLikeButton: Story = {
  name: "like button",
  render: () => (
    <StoryFrame width={480}>
      <LikeButtonDemo />
    </StoryFrame>
  ),
};

export const TransitionMenuDropdown: Story = {
  name: "menu dropdown",
  render: () => (
    <StoryFrame width={480}>
      <MenuDropdownDemo />
    </StoryFrame>
  ),
};

export const TransitionModal: Story = {
  name: "modal",
  render: () => (
    <StoryFrame width={480}>
      <ModalDemo />
    </StoryFrame>
  ),
};

export const TransitionNotificationBadge: Story = {
  name: "notification badge",
  render: () => (
    <StoryFrame width={480}>
      <NotificationBadgeDemo />
    </StoryFrame>
  ),
};

export const TransitionNumberPopIn: Story = {
  name: "number pop in",
  render: () => (
    <StoryFrame width={480}>
      <NumberPopInDemo />
    </StoryFrame>
  ),
};

export const TransitionPageSideBySide: Story = {
  name: "page side by side",
  render: () => (
    <StoryFrame width={480}>
      <PageSideBySideDemo />
    </StoryFrame>
  ),
};

export const TransitionPanelReveal: Story = {
  name: "panel reveal",
  render: () => (
    <StoryFrame width={480}>
      <PanelRevealDemo />
    </StoryFrame>
  ),
};

export const TransitionPlusMenuMorph: Story = {
  name: "plus menu morph",
  render: () => (
    <StoryFrame width={480}>
      <PlusMenuMorphDemo />
    </StoryFrame>
  ),
};

export const TransitionShimmerText: Story = {
  name: "shimmer text",
  render: () => (
    <StoryFrame width={480}>
      <ShimmerTextDemo />
    </StoryFrame>
  ),
};

export const TransitionSkeletonReveal: Story = {
  name: "skeleton reveal",
  render: () => (
    <StoryFrame width={480}>
      <SkeletonRevealDemo />
    </StoryFrame>
  ),
};

export const TransitionSpinningCounter: Story = {
  name: "spinning counter",
  render: () => (
    <StoryFrame width={480}>
      <SpinningCounterDemo />
    </StoryFrame>
  ),
};

export const TransitionSuccessCheck: Story = {
  name: "success check",
  render: () => (
    <StoryFrame width={480}>
      <SuccessCheckDemo />
    </StoryFrame>
  ),
};

export const TransitionTabsSliding: Story = {
  name: "tabs sliding",
  render: () => (
    <StoryFrame width={480}>
      <TabsSlidingDemo />
    </StoryFrame>
  ),
};

export const TransitionTextStatesSwap: Story = {
  name: "text states swap",
  render: () => (
    <StoryFrame width={480}>
      <TextStatesSwapDemo />
    </StoryFrame>
  ),
};

export const TransitionTextsReveal: Story = {
  name: "texts reveal",
  render: () => (
    <StoryFrame width={480}>
      <TextsRevealDemo />
    </StoryFrame>
  ),
};

export const TransitionToast: Story = {
  name: "toast",
  render: () => (
    <StoryFrame width={480}>
      <ToastDemo />
    </StoryFrame>
  ),
};

export const TransitionToggle: Story = {
  name: "toggle",
  render: () => (
    <StoryFrame width={480}>
      <ToggleDemo />
    </StoryFrame>
  ),
};

export const TransitionTooltip: Story = {
  name: "tooltip",
  render: () => (
    <StoryFrame width={480}>
      <TooltipDemo />
    </StoryFrame>
  ),
};
