import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, ArrowRight, Settings } from "lucide-react";
import { Button, buttonAttrs } from "./button";
import { Loader } from "./loader";
import { StoryRow } from "./gallery/frame";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One primary per screen. Outline on hairline. Ghost for quiet actions. Danger is delete only. Press scales to 0.97.",
      },
    },
  },
  args: { children: "Continue" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "outline", "ghost", "danger"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

const VARIANTS = ["primary", "outline", "ghost", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;

export const VariantGrid: Story = {
  render: () => (
    <StoryRow>
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant === "danger" ? "Delete" : variant === "primary" ? "Continue" : variant}
        </Button>
      ))}
    </StoryRow>
  ),
};

export const Sizes: Story = {
  render: () => (
    <StoryRow>
      {SIZES.map((size) => (
        <Button key={size} size={size}>
          {size}
        </Button>
      ))}
    </StoryRow>
  ),
};

export const WithLeftIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden="true" />
        Add item
      </>
    ),
  },
};

export const WithRightIcon: Story = {
  args: {
    children: (
      <>
        Continue
        <ArrowRight aria-hidden="true" />
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: "ghost",
    "aria-label": "Open settings",
    children: <Settings aria-hidden="true" />,
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const Loading: Story = {
  args: { disabled: true, children: "Saving" },
  render: (args) => (
    <Button {...args}>
      <Loader label="Saving" />
      Saving
    </Button>
  ),
};

export const WidthFull: Story = {
  args: { className: "w-full", children: "Full width" },
  decorators: [
    (Story) => (
      <div className="w-[20rem]">
        <Story />
      </div>
    ),
  ],
};

export const AsLink: Story = {
  render: () => (
    <a href="#continue" {...buttonAttrs({ variant: "primary" })}>
      Continue
    </a>
  ),
};
