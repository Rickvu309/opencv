import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Visible label above. Placeholder shows format, never acts as the label. Invalid is aria-invalid plus a sentence with a next step.",
      },
    },
  },
  args: {
    id: "input-default",
    type: "email",
    placeholder: "you@email.com",
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[20rem]">
      <Label htmlFor={args.id}>Email</Label>
      <Input {...args} />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="input-invalid">Email</Label>
      <Input
        id="input-invalid"
        type="email"
        defaultValue="not-an-email"
        aria-invalid
        aria-describedby="input-error"
      />
      <p id="input-error" className="mt-1 text-[13px] text-destructive">
        Enter an email.
      </p>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Label htmlFor="input-disabled">Email</Label>
      <Input id="input-disabled" type="email" defaultValue="you@email.com" disabled />
    </div>
  ),
};
