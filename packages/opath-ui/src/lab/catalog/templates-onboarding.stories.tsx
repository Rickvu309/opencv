import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Onboarding01 = lazy(() => import("../blocks-so/onboarding-01/onboarding-01").then((m) => ({ default: m.default ?? m.Onboarding01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding02 = lazy(() => import("../blocks-so/onboarding-02/onboarding-02").then((m) => ({ default: m.default ?? m.Onboarding02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding03 = lazy(() => import("../blocks-so/onboarding-03/onboarding-03").then((m) => ({ default: m.default ?? m.Onboarding03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding04 = lazy(() => import("../blocks-so/onboarding-04/onboarding-04").then((m) => ({ default: m.default ?? m.Onboarding04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding05 = lazy(() => import("../blocks-so/onboarding-05/onboarding-05").then((m) => ({ default: m.default ?? m.Onboarding05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding06 = lazy(() => import("../blocks-so/onboarding-06/onboarding-06").then((m) => ({ default: m.default ?? m.Onboarding06 ?? Object.values(m).find((v) => typeof v === "function") })));
const Onboarding07 = lazy(() => import("../blocks-so/onboarding-07/onboarding-07").then((m) => ({ default: m.default ?? m.Onboarding07 ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Templates/Onboarding" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockOnboarding01: Story = {
  name: "onboarding-01",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding01 />
    </LazyFrame>
  ),
};

export const BlockOnboarding02: Story = {
  name: "onboarding-02",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding02 />
    </LazyFrame>
  ),
};

export const BlockOnboarding03: Story = {
  name: "onboarding-03",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding03 />
    </LazyFrame>
  ),
};

export const BlockOnboarding04: Story = {
  name: "onboarding-04",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding04 />
    </LazyFrame>
  ),
};

export const BlockOnboarding05: Story = {
  name: "onboarding-05",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding05 />
    </LazyFrame>
  ),
};

export const BlockOnboarding06: Story = {
  name: "onboarding-06",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding06 />
    </LazyFrame>
  ),
};

export const BlockOnboarding07: Story = {
  name: "onboarding-07",
  render: () => (
    <LazyFrame width={720}>
      <Onboarding07 />
    </LazyFrame>
  ),
};
