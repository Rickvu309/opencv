import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/papers")({
  beforeLoad: () => {
    throw redirect({ to: "/paper" });
  },
});
