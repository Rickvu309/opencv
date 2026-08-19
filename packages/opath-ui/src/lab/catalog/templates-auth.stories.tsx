import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import Login01 from "../blocks-so/login-01/login-01";
import Login02 from "../blocks-so/login-02/login-02";
import Login03 from "../blocks-so/login-03/login-03";
import Login04 from "../blocks-so/login-04/login-04";
import Login05 from "../blocks-so/login-05/login-05";
import Login06 from "../blocks-so/login-06/login-06";
import Login07 from "../blocks-so/login-07/login-07";
import Login08 from "../blocks-so/login-08/login-08";
import Login09 from "../blocks-so/login-09/login-09";

const meta = { title: "Lab/Templates/Auth" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockLogin01: Story = {
  name: "login-01",
  render: () => (
    <StoryFrame width={720}>
      <Login01 />
    </StoryFrame>
  ),
};

export const BlockLogin02: Story = {
  name: "login-02",
  render: () => (
    <StoryFrame width={720}>
      <Login02 />
    </StoryFrame>
  ),
};

export const BlockLogin03: Story = {
  name: "login-03",
  render: () => (
    <StoryFrame width={720}>
      <Login03 />
    </StoryFrame>
  ),
};

export const BlockLogin04: Story = {
  name: "login-04",
  render: () => (
    <StoryFrame width={720}>
      <Login04 />
    </StoryFrame>
  ),
};

export const BlockLogin05: Story = {
  name: "login-05",
  render: () => (
    <StoryFrame width={720}>
      <Login05 />
    </StoryFrame>
  ),
};

export const BlockLogin06: Story = {
  name: "login-06",
  render: () => (
    <StoryFrame width={720}>
      <Login06 />
    </StoryFrame>
  ),
};

export const BlockLogin07: Story = {
  name: "login-07",
  render: () => (
    <StoryFrame width={720}>
      <Login07 />
    </StoryFrame>
  ),
};

export const BlockLogin08: Story = {
  name: "login-08",
  render: () => (
    <StoryFrame width={720}>
      <Login08 />
    </StoryFrame>
  ),
};

export const BlockLogin09: Story = {
  name: "login-09",
  render: () => (
    <StoryFrame width={720}>
      <Login09 />
    </StoryFrame>
  ),
};
