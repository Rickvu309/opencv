import type { Meta, StoryObj } from "@storybook/react-vite";
import type { FormEvent } from "react";
import { LandingPage } from "./landing-page";

const meta: Meta<typeof LandingPage> = {
  title: "Screens/Landing",
  component: LandingPage,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof LandingPage>;

const idleWaitlist = {
  email: "",
  emailError: "",
  joined: false,
  pending: false,
  onEmail: () => undefined,
  onSubmit: (e: FormEvent) => e.preventDefault(),
};

export const Default: Story = {
  args: {
    onComposerSend: () => undefined,
    waitlist: idleWaitlist,
  },
};

export const WaitlistPending: Story = {
  args: {
    onComposerSend: () => undefined,
    waitlist: { ...idleWaitlist, email: "you@school.edu", pending: true },
  },
};

export const WaitlistJoined: Story = {
  args: {
    onComposerSend: () => undefined,
    waitlist: { ...idleWaitlist, email: "you@school.edu", joined: true },
  },
};

export const WaitlistError: Story = {
  args: {
    onComposerSend: () => undefined,
    waitlist: {
      ...idleWaitlist,
      email: "nope",
      emailError: "Enter an email.",
    },
  },
};
