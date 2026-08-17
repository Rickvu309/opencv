import { createFileRoute } from "@tanstack/react-router";
import { CoachScreen } from "@/features/coach/screens/coach";

export const Route = createFileRoute("/_app/coach")({
  component: CoachScreen,
});
