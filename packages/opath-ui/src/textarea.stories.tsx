import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Writing surface. Min 7 lines on product editors. Same invalid and disabled contract as Input.",
      },
    },
  },
  args: {
    id: "textarea-default",
    placeholder: "A few lines",
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[20rem]">
      <Label htmlFor={args.id}>Notes</Label>
      <Textarea {...args} />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="textarea-invalid">Notes</Label>
      <Textarea id="textarea-invalid" aria-invalid aria-describedby="textarea-error" />
      <p id="textarea-error" className="mt-1 text-[13px] text-destructive">
        Add a note before you continue.
      </p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Saved notes" },
  render: (args) => (
    <div className="w-[20rem]">
      <Label htmlFor="textarea-disabled">Notes</Label>
      <Textarea id="textarea-disabled" {...args} />
    </div>
  ),
};
