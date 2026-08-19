import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Ai01 = lazy(() => import("../blocks-so/ai-01/ai-01").then((m) => ({ default: m.default ?? m.Ai01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Ai02 = lazy(() => import("../blocks-so/ai-02/ai-02").then((m) => ({ default: m.default ?? m.Ai02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Ai03 = lazy(() => import("../blocks-so/ai-03/ai-03").then((m) => ({ default: m.default ?? m.Ai03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Ai04 = lazy(() => import("../blocks-so/ai-04/ai-04").then((m) => ({ default: m.default ?? m.Ai04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Ai05 = lazy(() => import("../blocks-so/ai-05/ai-05").then((m) => ({ default: m.default ?? m.Ai05 ?? Object.values(m).find((v) => typeof v === "function") })));
const AiElements = lazy(() => import("../blocks-so/ai-elements/prompt-input").then((m) => ({ default: m.default ?? m.AiElements ?? Object.values(m).find((v) => typeof v === "function") })));
const CommandMenu01 = lazy(() => import("../blocks-so/command-menu-01/command-menu-01").then((m) => ({ default: m.default ?? m.CommandMenu01 ?? Object.values(m).find((v) => typeof v === "function") })));
const CommandMenu02 = lazy(() => import("../blocks-so/command-menu-02/command-menu-02").then((m) => ({ default: m.default ?? m.CommandMenu02 ?? Object.values(m).find((v) => typeof v === "function") })));
const CommandMenu03 = lazy(() => import("../blocks-so/command-menu-03/command-menu-03").then((m) => ({ default: m.default ?? m.CommandMenu03 ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Templates/AI" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockAi01: Story = {
  name: "ai-01",
  render: () => (
    <LazyFrame width={720}>
      <Ai01 />
    </LazyFrame>
  ),
};

export const BlockAi02: Story = {
  name: "ai-02",
  render: () => (
    <LazyFrame width={720}>
      <Ai02 />
    </LazyFrame>
  ),
};

export const BlockAi03: Story = {
  name: "ai-03",
  render: () => (
    <LazyFrame width={720}>
      <Ai03 />
    </LazyFrame>
  ),
};

export const BlockAi04: Story = {
  name: "ai-04",
  render: () => (
    <LazyFrame width={720}>
      <Ai04 />
    </LazyFrame>
  ),
};

export const BlockAi05: Story = {
  name: "ai-05",
  render: () => (
    <LazyFrame width={720}>
      <Ai05 />
    </LazyFrame>
  ),
};

export const BlockAiElements: Story = {
  name: "ai-elements",
  render: () => (
    <LazyFrame width={720}>
      <AiElements />
    </LazyFrame>
  ),
};

export const BlockCommandMenu01: Story = {
  name: "command-menu-01",
  render: () => (
    <LazyFrame width={720}>
      <CommandMenu01 />
    </LazyFrame>
  ),
};

export const BlockCommandMenu02: Story = {
  name: "command-menu-02",
  render: () => (
    <LazyFrame width={720}>
      <CommandMenu02 />
    </LazyFrame>
  ),
};

export const BlockCommandMenu03: Story = {
  name: "command-menu-03",
  render: () => (
    <LazyFrame width={720}>
      <CommandMenu03 />
    </LazyFrame>
  ),
};
