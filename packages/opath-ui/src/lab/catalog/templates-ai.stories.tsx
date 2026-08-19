import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import Ai01 from "../blocks-so/ai-01/ai-01";
import Ai02 from "../blocks-so/ai-02/ai-02";
import Ai03 from "../blocks-so/ai-03/ai-03";
import Ai04 from "../blocks-so/ai-04/ai-04";
import Ai05 from "../blocks-so/ai-05/ai-05";
import CommandMenu01 from "../blocks-so/command-menu-01/command-menu-01";
import CommandMenu02 from "../blocks-so/command-menu-02/command-menu-02";
import CommandMenu03 from "../blocks-so/command-menu-03/command-menu-03";

const meta = { title: "Lab/Templates/AI" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockAi01: Story = {
  name: "ai-01",
  render: () => (
    <StoryFrame width={720}>
      <Ai01 />
    </StoryFrame>
  ),
};

export const BlockAi02: Story = {
  name: "ai-02",
  render: () => (
    <StoryFrame width={720}>
      <Ai02 />
    </StoryFrame>
  ),
};

export const BlockAi03: Story = {
  name: "ai-03",
  render: () => (
    <StoryFrame width={720}>
      <Ai03 />
    </StoryFrame>
  ),
};

export const BlockAi04: Story = {
  name: "ai-04",
  render: () => (
    <StoryFrame width={720}>
      <Ai04 />
    </StoryFrame>
  ),
};

export const BlockAi05: Story = {
  name: "ai-05",
  render: () => (
    <StoryFrame width={720}>
      <Ai05 />
    </StoryFrame>
  ),
};

export const BlockCommandMenu01: Story = {
  name: "command-menu-01",
  render: () => (
    <StoryFrame width={720}>
      <CommandMenu01 />
    </StoryFrame>
  ),
};

export const BlockCommandMenu02: Story = {
  name: "command-menu-02",
  render: () => (
    <StoryFrame width={720}>
      <CommandMenu02 />
    </StoryFrame>
  ),
};

export const BlockCommandMenu03: Story = {
  name: "command-menu-03",
  render: () => (
    <StoryFrame width={720}>
      <CommandMenu03 />
    </StoryFrame>
  ),
};
