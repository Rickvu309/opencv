import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    next: z.string().optional(),
  }),
  component: SignInPage,
});

function SignInPage() {
  const { next } = Route.useSearch();
  return <AuthForm mode="sign-in" next={next} />;
}
