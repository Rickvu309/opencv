import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthForm } from "./auth-form";

const meta: Meta<typeof AuthForm> = {
  title: "Auth/Screen",
  component: AuthForm,
};
export default meta;

type Story = StoryObj<typeof AuthForm>;

export const SignIn: Story = {
  args: {
    mode: "sign-in",
    onSuccess: () => undefined,
    onSubmit: async () => ({ ok: true }),
  },
};

export const SignUp: Story = {
  args: {
    mode: "sign-up",
    onSuccess: () => undefined,
    onSubmit: async () => ({ ok: true }),
  },
};

export const SignInError: Story = {
  args: {
    mode: "sign-in",
    onSuccess: () => undefined,
    onSubmit: async () => ({ ok: false, error: "Email or password is wrong. Try again." }),
  },
};

export const SignUpTaken: Story = {
  args: {
    mode: "sign-up",
    onSuccess: () => undefined,
    onSubmit: async () => ({
      ok: false,
      field: "email",
      error: "That email is already in use. Sign in instead.",
    }),
  },
};
