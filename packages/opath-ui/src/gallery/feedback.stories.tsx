import type { Meta, StoryObj } from "@storybook/react-vite";
import { Code } from "../code";
import { InfoBlock } from "../info-block";
import { Keycap } from "../keycap";
import { Loader } from "../loader";
import { SkeletonHistory, SkeletonPage, SkeletonRows, SkeletonSection, SkeletonThread } from "../skeleton";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Components/Feedback",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const LoaderRest: Story = {
  render: () => <Loader label="Loading" />,
};

export const Info: Story = {
  render: () => <InfoBlock>A quiet note with a next step.</InfoBlock>,
};

export const CodeBlock: Story = {
  render: () => <Code value="noun.verb">noun.verb</Code>,
};

export const Keys: Story = {
  render: () => (
    <div className="flex gap-2">
      <Keycap>Enter</Keycap>
      <Keycap>Esc</Keycap>
    </div>
  ),
};

export const Skeletons: Story = {
  render: () => (
    <GalleryPage title="Skeleton" note="Holds the exact slot of the content it precedes. Never an empty state.">
      <GallerySection title="Rows">
        <div className="w-[28rem]">
          <SkeletonRows count={3} />
        </div>
      </GallerySection>
      <GallerySection title="Section">
        <div className="w-[20rem]">
          <SkeletonSection />
        </div>
      </GallerySection>
      <GallerySection title="History">
        <div className="w-[16rem]">
          <SkeletonHistory count={4} />
        </div>
      </GallerySection>
      <GallerySection title="Thread">
        <div className="w-[28rem]">
          <SkeletonThread count={3} />
        </div>
      </GallerySection>
      <GallerySection title="Page">
        <div className="w-[28rem]">
          <SkeletonPage />
        </div>
      </GallerySection>
    </GalleryPage>
  ),
};
