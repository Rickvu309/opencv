import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Dialog01 = lazy(() => import("../blocks-so/dialog-01/dialog-01").then((m) => ({ default: m.default ?? m.Dialog01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog02 = lazy(() => import("../blocks-so/dialog-02/dialog-02").then((m) => ({ default: m.default ?? m.Dialog02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog03 = lazy(() => import("../blocks-so/dialog-03/dialog-03").then((m) => ({ default: m.default ?? m.Dialog03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog04 = lazy(() => import("../blocks-so/dialog-04/dialog-04").then((m) => ({ default: m.default ?? m.Dialog04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog05 = lazy(() => import("../blocks-so/dialog-05/dialog-05").then((m) => ({ default: m.default ?? m.Dialog05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog06 = lazy(() => import("../blocks-so/dialog-06/dialog-06").then((m) => ({ default: m.default ?? m.Dialog06 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog07 = lazy(() => import("../blocks-so/dialog-07/dialog-07").then((m) => ({ default: m.default ?? m.Dialog07 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog08 = lazy(() => import("../blocks-so/dialog-08/dialog-08").then((m) => ({ default: m.default ?? m.Dialog08 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog09 = lazy(() => import("../blocks-so/dialog-09/dialog-09").then((m) => ({ default: m.default ?? m.Dialog09 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog10 = lazy(() => import("../blocks-so/dialog-10/dialog-10").then((m) => ({ default: m.default ?? m.Dialog10 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog11 = lazy(() => import("../blocks-so/dialog-11/dialog-11").then((m) => ({ default: m.default ?? m.Dialog11 ?? Object.values(m).find((v) => typeof v === "function") })));
const Dialog12 = lazy(() => import("../blocks-so/dialog-12/dialog-12").then((m) => ({ default: m.default ?? m.Dialog12 ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Templates/Dialogs" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockDialog01: Story = {
  name: "dialog-01",
  render: () => (
    <LazyFrame width={720}>
      <Dialog01 />
    </LazyFrame>
  ),
};

export const BlockDialog02: Story = {
  name: "dialog-02",
  render: () => (
    <LazyFrame width={720}>
      <Dialog02 />
    </LazyFrame>
  ),
};

export const BlockDialog03: Story = {
  name: "dialog-03",
  render: () => (
    <LazyFrame width={720}>
      <Dialog03 />
    </LazyFrame>
  ),
};

export const BlockDialog04: Story = {
  name: "dialog-04",
  render: () => (
    <LazyFrame width={720}>
      <Dialog04 />
    </LazyFrame>
  ),
};

export const BlockDialog05: Story = {
  name: "dialog-05",
  render: () => (
    <LazyFrame width={720}>
      <Dialog05 />
    </LazyFrame>
  ),
};

export const BlockDialog06: Story = {
  name: "dialog-06",
  render: () => (
    <LazyFrame width={720}>
      <Dialog06 />
    </LazyFrame>
  ),
};

export const BlockDialog07: Story = {
  name: "dialog-07",
  render: () => (
    <LazyFrame width={720}>
      <Dialog07 />
    </LazyFrame>
  ),
};

export const BlockDialog08: Story = {
  name: "dialog-08",
  render: () => (
    <LazyFrame width={720}>
      <Dialog08 />
    </LazyFrame>
  ),
};

export const BlockDialog09: Story = {
  name: "dialog-09",
  render: () => (
    <LazyFrame width={720}>
      <Dialog09 />
    </LazyFrame>
  ),
};

export const BlockDialog10: Story = {
  name: "dialog-10",
  render: () => (
    <LazyFrame width={720}>
      <Dialog10 />
    </LazyFrame>
  ),
};

export const BlockDialog11: Story = {
  name: "dialog-11",
  render: () => (
    <LazyFrame width={720}>
      <Dialog11 />
    </LazyFrame>
  ),
};

export const BlockDialog12: Story = {
  name: "dialog-12",
  render: () => (
    <LazyFrame width={720}>
      <Dialog12 />
    </LazyFrame>
  ),
};
