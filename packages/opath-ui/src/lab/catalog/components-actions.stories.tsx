import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { ActionSwapPreview } from "../beui/previews/action-swap.preview";
import { ButtonPreview } from "../beui/previews/button.preview";
import { ExpandingArrowButtonPreview } from "../beui/previews/expanding-arrow-button.preview";
import { SelectionActions } from "../beautiful/selection-actions";
import ButtonDemo from "../eightstar/examples/button-demo";
import Example_ThemeSwitcherUncontrolled from "../kibo/_examples/theme-switcher-uncontrolled";
import Example_ThemeSwitcher from "../kibo/_examples/theme-switcher";

const meta = { title: "Lab/Components/Actions" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiActionSwap: Story = {
  name: "action swap",
  render: () => (
    <StoryFrame width={560}>
      <ActionSwapPreview />
    </StoryFrame>
  ),
};

export const BeuiButton: Story = {
  name: "button",
  render: () => (
    <StoryFrame width={560}>
      <ButtonPreview />
    </StoryFrame>
  ),
};

export const BeuiExpandingArrowButton: Story = {
  name: "expanding arrow button",
  render: () => (
    <StoryFrame width={560}>
      <ExpandingArrowButtonPreview />
    </StoryFrame>
  ),
};

export const BeautifulSelectionActions: Story = {
  name: "Selection Actions",
  render: () => (
    <StoryFrame width={560}>
      <SelectionActions />
    </StoryFrame>
  ),
};

export const EightstarButtonDemo: Story = {
  name: "button",
  render: () => (
    <StoryFrame width={640}>
      <ButtonDemo />
    </StoryFrame>
  ),
};

export const KiboThemeSwitcherUncontrolled: Story = {
  name: "theme switcher uncontrolled",
  render: () => (
    <StoryFrame width={720}>
      <Example_ThemeSwitcherUncontrolled />
    </StoryFrame>
  ),
};

export const KiboThemeSwitcher: Story = {
  name: "theme switcher",
  render: () => (
    <StoryFrame width={720}>
      <Example_ThemeSwitcher />
    </StoryFrame>
  ),
};
