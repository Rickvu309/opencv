import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, EmptyMessageCard, EndOfList } from "../card";
import { InfoBlock } from "../info-block";
import { Mark } from "../mark";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Components/Card",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
  render: () => (
    <Card className="w-[20rem]">
      <p className="text-[15px] font-[510]">Card label</p>
      <p className="mt-1 text-[13px] text-ink-muted">Meta line</p>
    </Card>
  ),
};

export const EmptyMessage: Story = {
  render: () => <EmptyMessageCard title="Nothing in this thread yet." />,
};

export const All: Story = {
  render: () => (
    <GalleryPage title="Card" note="Surface-1, hairline, radius-container, 16px padding.">
      <GallerySection title="Artifact">
        <Card className="w-[20rem]">
          <p className="text-[15px] font-[510]">Card label</p>
          <p className="mt-1 text-[13px] text-ink-muted">Meta line</p>
        </Card>
      </GallerySection>
      <GallerySection title="Empty message">
        <EmptyMessageCard title="Nothing in this thread yet." />
      </GallerySection>
      <GallerySection title="Callout">
        <InfoBlock>A quiet note with a next step.</InfoBlock>
      </GallerySection>
      <GallerySection title="Mark">
        <Mark className="size-8" />
      </GallerySection>
      <EndOfList />
    </GalleryPage>
  ),
};
