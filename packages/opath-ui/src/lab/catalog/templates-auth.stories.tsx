import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Login01 = lazy(() => import("../blocks-so/login-01/login-01").then((m) => ({ default: m.default ?? m.Login01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login02 = lazy(() => import("../blocks-so/login-02/login-02").then((m) => ({ default: m.default ?? m.Login02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login03 = lazy(() => import("../blocks-so/login-03/login-03").then((m) => ({ default: m.default ?? m.Login03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login04 = lazy(() => import("../blocks-so/login-04/login-04").then((m) => ({ default: m.default ?? m.Login04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login05 = lazy(() => import("../blocks-so/login-05/login-05").then((m) => ({ default: m.default ?? m.Login05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login06 = lazy(() => import("../blocks-so/login-06/login-06").then((m) => ({ default: m.default ?? m.Login06 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login07 = lazy(() => import("../blocks-so/login-07/login-07").then((m) => ({ default: m.default ?? m.Login07 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login08 = lazy(() => import("../blocks-so/login-08/login-08").then((m) => ({ default: m.default ?? m.Login08 ?? Object.values(m).find((v) => typeof v === "function") })));
const Login09 = lazy(() => import("../blocks-so/login-09/login-09").then((m) => ({ default: m.default ?? m.Login09 ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = {
  title: "Lab/Templates/Auth",
  parameters: {
    docs: {
      description: {
        component:
          "Sourced login layouts for review. Product sign-in and sign-up live in Opath (Production) Storybook under Auth/Screen — same card size, not these templates.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockLogin01: Story = {
  name: "login-01",
  render: () => (
    <LazyFrame width={720}>
      <Login01 />
    </LazyFrame>
  ),
};

export const BlockLogin02: Story = {
  name: "login-02",
  render: () => (
    <LazyFrame width={720}>
      <Login02 />
    </LazyFrame>
  ),
};

export const BlockLogin03: Story = {
  name: "login-03",
  render: () => (
    <LazyFrame width={720}>
      <Login03 />
    </LazyFrame>
  ),
};

export const BlockLogin04: Story = {
  name: "login-04",
  render: () => (
    <LazyFrame width={720}>
      <Login04 />
    </LazyFrame>
  ),
};

export const BlockLogin05: Story = {
  name: "login-05",
  render: () => (
    <LazyFrame width={720}>
      <Login05 />
    </LazyFrame>
  ),
};

export const BlockLogin06: Story = {
  name: "login-06",
  render: () => (
    <LazyFrame width={720}>
      <Login06 />
    </LazyFrame>
  ),
};

export const BlockLogin07: Story = {
  name: "login-07",
  render: () => (
    <LazyFrame width={720}>
      <Login07 />
    </LazyFrame>
  ),
};

export const BlockLogin08: Story = {
  name: "login-08",
  render: () => (
    <LazyFrame width={720}>
      <Login08 />
    </LazyFrame>
  ),
};

export const BlockLogin09: Story = {
  name: "login-09",
  render: () => (
    <LazyFrame width={720}>
      <Login09 />
    </LazyFrame>
  ),
};
