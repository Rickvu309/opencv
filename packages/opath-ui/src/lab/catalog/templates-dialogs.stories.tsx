import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import Dialog01 from "../blocks-so/dialog-01/dialog-01";
import Dialog02 from "../blocks-so/dialog-02/dialog-02";
import Dialog03 from "../blocks-so/dialog-03/dialog-03";
import Dialog04 from "../blocks-so/dialog-04/dialog-04";
import Dialog05 from "../blocks-so/dialog-05/dialog-05";
import Dialog06 from "../blocks-so/dialog-06/dialog-06";
import Dialog07 from "../blocks-so/dialog-07/dialog-07";
import Dialog08 from "../blocks-so/dialog-08/dialog-08";
import Dialog09 from "../blocks-so/dialog-09/dialog-09";
import Dialog10 from "../blocks-so/dialog-10/dialog-10";
import Dialog11 from "../blocks-so/dialog-11/dialog-11";
import Dialog12 from "../blocks-so/dialog-12/dialog-12";

const meta = { title: "Lab/Templates/Dialogs" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockDialog01: Story = {
  name: "dialog-01",
  render: () => (
    <StoryFrame width={720}>
      <Dialog01 />
    </StoryFrame>
  ),
};

export const BlockDialog02: Story = {
  name: "dialog-02",
  render: () => (
    <StoryFrame width={720}>
      <Dialog02 />
    </StoryFrame>
  ),
};

export const BlockDialog03: Story = {
  name: "dialog-03",
  render: () => (
    <StoryFrame width={720}>
      <Dialog03 />
    </StoryFrame>
  ),
};

export const BlockDialog04: Story = {
  name: "dialog-04",
  render: () => (
    <StoryFrame width={720}>
      <Dialog04 />
    </StoryFrame>
  ),
};

export const BlockDialog05: Story = {
  name: "dialog-05",
  render: () => (
    <StoryFrame width={720}>
      <Dialog05 />
    </StoryFrame>
  ),
};

export const BlockDialog06: Story = {
  name: "dialog-06",
  render: () => (
    <StoryFrame width={720}>
      <Dialog06 />
    </StoryFrame>
  ),
};

export const BlockDialog07: Story = {
  name: "dialog-07",
  render: () => (
    <StoryFrame width={720}>
      <Dialog07 />
    </StoryFrame>
  ),
};

export const BlockDialog08: Story = {
  name: "dialog-08",
  render: () => (
    <StoryFrame width={720}>
      <Dialog08 />
    </StoryFrame>
  ),
};

export const BlockDialog09: Story = {
  name: "dialog-09",
  render: () => (
    <StoryFrame width={720}>
      <Dialog09 />
    </StoryFrame>
  ),
};

export const BlockDialog10: Story = {
  name: "dialog-10",
  render: () => (
    <StoryFrame width={720}>
      <Dialog10 />
    </StoryFrame>
  ),
};

export const BlockDialog11: Story = {
  name: "dialog-11",
  render: () => (
    <StoryFrame width={720}>
      <Dialog11 />
    </StoryFrame>
  ),
};

export const BlockDialog12: Story = {
  name: "dialog-12",
  render: () => (
    <StoryFrame width={720}>
      <Dialog12 />
    </StoryFrame>
  ),
};
