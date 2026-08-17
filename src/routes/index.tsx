import { createFileRoute } from "@tanstack/react-router";
import { LandingScreen } from "@/features/landing/screens/landing";

export const Route = createFileRoute("/")({
  component: LandingScreen,
});
