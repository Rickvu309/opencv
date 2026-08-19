import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Loader } from "../loader";
import { GalleryPage } from "./frame";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: { children: "Continue" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = {
  args: { disabled: true, children: "Saving" },
  render: (args) => (
    <Button {...args}>
      <Loader label="Saving" />
      Saving
    </Button>
  ),
};

export const All: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <GalleryPage title="Button" note="One primary per screen. Danger is delete only. Press scales to 0.97.">
      <div className="flex flex-wrap gap-2">
        <Button>Continue</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
    </GalleryPage>
  ),
};
