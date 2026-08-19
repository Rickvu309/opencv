import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { Label } from "../label";
import { Switch } from "../switch";
import { Textarea } from "../textarea";
import { GalleryPage, GallerySection } from "./frame";

const meta: Meta = {
  title: "Components/Field",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="field-email">Email</Label>
      <Input id="field-email" type="email" placeholder="you@email.com" />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="field-email-invalid">Email</Label>
      <Input
        id="field-email-invalid"
        type="email"
        defaultValue="not-an-email"
        aria-invalid
        aria-describedby="field-email-error"
      />
      <p id="field-email-error" className="mt-1 text-[13px] text-destructive">
        Enter an email.
      </p>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="field-email-disabled">Email</Label>
      <Input id="field-email-disabled" type="email" defaultValue="you@email.com" disabled />
    </div>
  ),
};

export const Writing: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="field-notes">Notes</Label>
      <Textarea id="field-notes" placeholder="A few lines" />
    </div>
  ),
};

export const Toggles: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
        <Checkbox defaultChecked aria-label="Done" />
        Done
      </label>
      <label className="flex min-h-[var(--size-touch)] items-center gap-2 text-[13px]">
        <Switch defaultChecked aria-label="Notify before deadlines" />
        Notify before deadlines
      </label>
    </div>
  ),
};

export const All: Story = {
  render: () => (
    <GalleryPage title="Field" note="Visible labels. Placeholder is not a label. Invalid is a sentence with a next step.">
      <GallerySection title="Rest">
        <div className="w-[20rem]">
          <Label htmlFor="all-email">Email</Label>
          <Input id="all-email" type="email" placeholder="you@email.com" />
        </div>
      </GallerySection>
      <GallerySection title="Invalid">
        <div className="w-[20rem]">
          <Label htmlFor="all-invalid">Email</Label>
          <Input id="all-invalid" type="email" defaultValue="not-an-email" aria-invalid aria-describedby="all-error" />
          <p id="all-error" className="mt-1 text-[13px] text-destructive">
            Enter an email.
          </p>
        </div>
      </GallerySection>
      <GallerySection title="Writing">
        <div className="w-[20rem]">
          <Label htmlFor="all-notes">Notes</Label>
          <Textarea id="all-notes" placeholder="A few lines" />
        </div>
      </GallerySection>
    </GalleryPage>
  ),
};
