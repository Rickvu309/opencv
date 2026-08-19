import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const BouncyAccordionPreview = lazy(() => import("../beui/previews/bouncy-accordion.preview").then((m) => ({ default: m.BouncyAccordionPreview })));
const CylinderCarouselPreview = lazy(() => import("../beui/previews/cylinder-carousel.preview").then((m) => ({ default: m.CylinderCarouselPreview })));
const MarqueePreview = lazy(() => import("../beui/previews/marquee.preview").then((m) => ({ default: m.MarqueePreview })));
const NumberPreview = lazy(() => import("../beui/previews/number.preview").then((m) => ({ default: m.NumberPreview })));
const PullToRefreshPreview = lazy(() => import("../beui/previews/pull-to-refresh.preview").then((m) => ({ default: m.PullToRefreshPreview })));
const ShaderBackgroundPreview = lazy(() => import("../beui/previews/shader-background.preview").then((m) => ({ default: m.ShaderBackgroundPreview })));
const SharedLayoutBgPreview = lazy(() => import("../beui/previews/shared-layout-bg.preview").then((m) => ({ default: m.SharedLayoutBgPreview })));
const TextAnimationPreview = lazy(() => import("../beui/previews/text-animation.preview").then((m) => ({ default: m.TextAnimationPreview })));
const ThemeTogglePreview = lazy(() => import("../beui/previews/theme-toggle.preview").then((m) => ({ default: m.ThemeTogglePreview })));
const TiltCardPreview = lazy(() => import("../beui/previews/tilt-card.preview").then((m) => ({ default: m.TiltCardPreview })));
const AccordionDemo = lazy(() => import("../transitions/accordion").then((m) => ({ default: m.Accordion })));
const AvatarGroupHoverDemo = lazy(() => import("../transitions/avatar-group-hover").then((m) => ({ default: m.AvatarGroupHover })));
const CardResizeDemo = lazy(() => import("../transitions/card-resize").then((m) => ({ default: m.CardResize })));
const CardTiltDemo = lazy(() => import("../transitions/card-tilt").then((m) => ({ default: m.CardTilt })));
const CheckboxCheckDemo = lazy(() => import("../transitions/checkbox-check").then((m) => ({ default: m.CheckboxCheck })));
const ErrorStateShakeDemo = lazy(() => import("../transitions/error-state-shake").then((m) => ({ default: m.ErrorStateShake })));
const IconSwapDemo = lazy(() => import("../transitions/icon-swap").then((m) => ({ default: m.IconSwap })));
const InputClearDissolveDemo = lazy(() => import("../transitions/input-clear-dissolve").then((m) => ({ default: m.InputClearDissolve })));
const LearnMoreHoverDemo = lazy(() => import("../transitions/learn-more-hover").then((m) => ({ default: m.LearnMoreHover })));
const LikeButtonDemo = lazy(() => import("../transitions/like-button").then((m) => ({ default: m.LikeButton })));
const MenuDropdownDemo = lazy(() => import("../transitions/menu-dropdown").then((m) => ({ default: m.MenuDropdown })));
const ModalDemo = lazy(() => import("../transitions/modal").then((m) => ({ default: m.Modal })));
const NotificationBadgeDemo = lazy(() => import("../transitions/notification-badge").then((m) => ({ default: m.NotificationBadge })));
const NumberPopInDemo = lazy(() => import("../transitions/number-pop-in").then((m) => ({ default: m.NumberPopIn })));
const PageSideBySideDemo = lazy(() => import("../transitions/page-side-by-side").then((m) => ({ default: m.PageSideBySide })));
const PanelRevealDemo = lazy(() => import("../transitions/panel-reveal").then((m) => ({ default: m.PanelReveal })));
const PlusMenuMorphDemo = lazy(() => import("../transitions/plus-menu-morph").then((m) => ({ default: m.PlusMenuMorph })));
const ShimmerTextDemo = lazy(() => import("../transitions/shimmer-text").then((m) => ({ default: m.ShimmerText })));
const SkeletonRevealDemo = lazy(() => import("../transitions/skeleton-reveal").then((m) => ({ default: m.SkeletonReveal })));
const SpinningCounterDemo = lazy(() => import("../transitions/spinning-counter").then((m) => ({ default: m.SpinningCounter })));
const SuccessCheckDemo = lazy(() => import("../transitions/success-check").then((m) => ({ default: m.SuccessCheck })));
const TabsSlidingDemo = lazy(() => import("../transitions/tabs-sliding").then((m) => ({ default: m.TabsSliding })));
const TextStatesSwapDemo = lazy(() => import("../transitions/text-states-swap").then((m) => ({ default: m.TextStatesSwap })));
const TextsRevealDemo = lazy(() => import("../transitions/texts-reveal").then((m) => ({ default: m.TextsReveal })));
const ToastDemo = lazy(() => import("../transitions/toast").then((m) => ({ default: m.Toast })));
const ToggleDemo = lazy(() => import("../transitions/toggle").then((m) => ({ default: m.Toggle })));
const TooltipDemo = lazy(() => import("../transitions/tooltip").then((m) => ({ default: m.Tooltip })));

const meta = { title: "Lab/Components/Motion" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiBouncyAccordion: Story = {
  name: "bouncy accordion",
  render: () => (
    <LazyFrame width={560}>
      <BouncyAccordionPreview />
    </LazyFrame>
  ),
};

export const BeuiCylinderCarousel: Story = {
  name: "cylinder carousel",
  render: () => (
    <LazyFrame width={560}>
      <CylinderCarouselPreview />
    </LazyFrame>
  ),
};

export const BeuiMarquee: Story = {
  name: "marquee",
  render: () => (
    <LazyFrame width={560}>
      <MarqueePreview />
    </LazyFrame>
  ),
};

export const BeuiNumber: Story = {
  name: "number",
  render: () => (
    <LazyFrame width={560}>
      <NumberPreview />
    </LazyFrame>
  ),
};

export const BeuiPullToRefresh: Story = {
  name: "pull to refresh",
  render: () => (
    <LazyFrame width={560}>
      <PullToRefreshPreview />
    </LazyFrame>
  ),
};

export const BeuiShaderBackground: Story = {
  name: "shader background",
  render: () => (
    <LazyFrame width={560}>
      <ShaderBackgroundPreview />
    </LazyFrame>
  ),
};

export const BeuiSharedLayoutBg: Story = {
  name: "shared layout bg",
  render: () => (
    <LazyFrame width={560}>
      <SharedLayoutBgPreview />
    </LazyFrame>
  ),
};

export const BeuiTextAnimation: Story = {
  name: "text animation",
  render: () => (
    <LazyFrame width={560}>
      <TextAnimationPreview />
    </LazyFrame>
  ),
};

export const BeuiThemeToggle: Story = {
  name: "theme toggle",
  render: () => (
    <LazyFrame width={560}>
      <ThemeTogglePreview />
    </LazyFrame>
  ),
};

export const BeuiTiltCard: Story = {
  name: "tilt card",
  render: () => (
    <LazyFrame width={560}>
      <TiltCardPreview />
    </LazyFrame>
  ),
};

export const TransitionAccordion: Story = {
  name: "accordion",
  render: () => (
    <LazyFrame width={480}>
      <AccordionDemo />
    </LazyFrame>
  ),
};

export const TransitionAvatarGroupHover: Story = {
  name: "avatar group hover",
  render: () => (
    <LazyFrame width={480}>
      <AvatarGroupHoverDemo />
    </LazyFrame>
  ),
};

export const TransitionCardResize: Story = {
  name: "card resize",
  render: () => (
    <LazyFrame width={480}>
      <CardResizeDemo />
    </LazyFrame>
  ),
};

export const TransitionCardTilt: Story = {
  name: "card tilt",
  render: () => (
    <LazyFrame width={480}>
      <CardTiltDemo />
    </LazyFrame>
  ),
};

export const TransitionCheckboxCheck: Story = {
  name: "checkbox check",
  render: () => (
    <LazyFrame width={480}>
      <CheckboxCheckDemo />
    </LazyFrame>
  ),
};

export const TransitionErrorStateShake: Story = {
  name: "error state shake",
  render: () => (
    <LazyFrame width={480}>
      <ErrorStateShakeDemo />
    </LazyFrame>
  ),
};

export const TransitionIconSwap: Story = {
  name: "icon swap",
  render: () => (
    <LazyFrame width={480}>
      <IconSwapDemo />
    </LazyFrame>
  ),
};

export const TransitionInputClearDissolve: Story = {
  name: "input clear dissolve",
  render: () => (
    <LazyFrame width={480}>
      <InputClearDissolveDemo />
    </LazyFrame>
  ),
};

export const TransitionLearnMoreHover: Story = {
  name: "learn more hover",
  render: () => (
    <LazyFrame width={480}>
      <LearnMoreHoverDemo />
    </LazyFrame>
  ),
};

export const TransitionLikeButton: Story = {
  name: "like button",
  render: () => (
    <LazyFrame width={480}>
      <LikeButtonDemo />
    </LazyFrame>
  ),
};

export const TransitionMenuDropdown: Story = {
  name: "menu dropdown",
  render: () => (
    <LazyFrame width={480}>
      <MenuDropdownDemo />
    </LazyFrame>
  ),
};

export const TransitionModal: Story = {
  name: "modal",
  render: () => (
    <LazyFrame width={480}>
      <ModalDemo />
    </LazyFrame>
  ),
};

export const TransitionNotificationBadge: Story = {
  name: "notification badge",
  render: () => (
    <LazyFrame width={480}>
      <NotificationBadgeDemo />
    </LazyFrame>
  ),
};

export const TransitionNumberPopIn: Story = {
  name: "number pop in",
  render: () => (
    <LazyFrame width={480}>
      <NumberPopInDemo />
    </LazyFrame>
  ),
};

export const TransitionPageSideBySide: Story = {
  name: "page side by side",
  render: () => (
    <LazyFrame width={480}>
      <PageSideBySideDemo />
    </LazyFrame>
  ),
};

export const TransitionPanelReveal: Story = {
  name: "panel reveal",
  render: () => (
    <LazyFrame width={480}>
      <PanelRevealDemo />
    </LazyFrame>
  ),
};

export const TransitionPlusMenuMorph: Story = {
  name: "plus menu morph",
  render: () => (
    <LazyFrame width={480}>
      <PlusMenuMorphDemo />
    </LazyFrame>
  ),
};

export const TransitionShimmerText: Story = {
  name: "shimmer text",
  render: () => (
    <LazyFrame width={480}>
      <ShimmerTextDemo />
    </LazyFrame>
  ),
};

export const TransitionSkeletonReveal: Story = {
  name: "skeleton reveal",
  render: () => (
    <LazyFrame width={480}>
      <SkeletonRevealDemo />
    </LazyFrame>
  ),
};

export const TransitionSpinningCounter: Story = {
  name: "spinning counter",
  render: () => (
    <LazyFrame width={480}>
      <SpinningCounterDemo />
    </LazyFrame>
  ),
};

export const TransitionSuccessCheck: Story = {
  name: "success check",
  render: () => (
    <LazyFrame width={480}>
      <SuccessCheckDemo />
    </LazyFrame>
  ),
};

export const TransitionTabsSliding: Story = {
  name: "tabs sliding",
  render: () => (
    <LazyFrame width={480}>
      <TabsSlidingDemo />
    </LazyFrame>
  ),
};

export const TransitionTextStatesSwap: Story = {
  name: "text states swap",
  render: () => (
    <LazyFrame width={480}>
      <TextStatesSwapDemo />
    </LazyFrame>
  ),
};

export const TransitionTextsReveal: Story = {
  name: "texts reveal",
  render: () => (
    <LazyFrame width={480}>
      <TextsRevealDemo />
    </LazyFrame>
  ),
};

export const TransitionToast: Story = {
  name: "toast",
  render: () => (
    <LazyFrame width={480}>
      <ToastDemo />
    </LazyFrame>
  ),
};

export const TransitionToggle: Story = {
  name: "toggle",
  render: () => (
    <LazyFrame width={480}>
      <ToggleDemo />
    </LazyFrame>
  ),
};

export const TransitionTooltip: Story = {
  name: "tooltip",
  render: () => (
    <LazyFrame width={480}>
      <TooltipDemo />
    </LazyFrame>
  ),
};
