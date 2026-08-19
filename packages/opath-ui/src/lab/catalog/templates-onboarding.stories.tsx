import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import Onboarding01 from "../blocks-so/onboarding-01/onboarding-01";
import Onboarding02 from "../blocks-so/onboarding-02/onboarding-02";
import Onboarding03 from "../blocks-so/onboarding-03/onboarding-03";
import Onboarding04 from "../blocks-so/onboarding-04/onboarding-04";
import Onboarding05 from "../blocks-so/onboarding-05/onboarding-05";
import Onboarding06 from "../blocks-so/onboarding-06/onboarding-06";
import Onboarding07 from "../blocks-so/onboarding-07/onboarding-07";

const meta = { title: "Lab/Templates/Onboarding" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockOnboarding01: Story = {
  name: "onboarding-01",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding01 />
    </StoryFrame>
  ),
};

export const BlockOnboarding02: Story = {
  name: "onboarding-02",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding02 />
    </StoryFrame>
  ),
};

export const BlockOnboarding03: Story = {
  name: "onboarding-03",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding03 />
    </StoryFrame>
  ),
};

export const BlockOnboarding04: Story = {
  name: "onboarding-04",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding04 />
    </StoryFrame>
  ),
};

export const BlockOnboarding05: Story = {
  name: "onboarding-05",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding05 />
    </StoryFrame>
  ),
};

export const BlockOnboarding06: Story = {
  name: "onboarding-06",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding06 />
    </StoryFrame>
  ),
};

export const BlockOnboarding07: Story = {
  name: "onboarding-07",
  render: () => (
    <StoryFrame width={720}>
      <Onboarding07 />
    </StoryFrame>
  ),
};
