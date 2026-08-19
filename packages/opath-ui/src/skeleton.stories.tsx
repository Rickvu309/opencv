import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  SkeletonHistory,
  SkeletonPage,
  SkeletonRows,
  SkeletonSection,
  SkeletonThread,
} from "./skeleton";

const meta: Meta = {
  title: "Components/Skeleton",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Holds the exact slot of the content it precedes. Never shown as an empty state. aria-busy on the group.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Rows: Story = {
  render: () => (
    <div className="w-[28rem]">
      <SkeletonRows count={3} />
    </div>
  ),
};

export const Section: Story = {
  render: () => (
    <div className="w-[20rem]">
      <SkeletonSection />
    </div>
  ),
};

export const History: Story = {
  render: () => (
    <div className="w-[16rem]">
      <SkeletonHistory count={4} />
    </div>
  ),
};

export const Thread: Story = {
  render: () => (
    <div className="w-[28rem]">
      <SkeletonThread count={3} />
    </div>
  ),
};

export const Page: Story = {
  render: () => (
    <div className="w-[28rem]">
      <SkeletonPage />
    </div>
  ),
};
