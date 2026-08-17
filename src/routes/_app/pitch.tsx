import { createFileRoute } from "@tanstack/react-router";
import { PitchScreen } from "@/features/pitch/screens/pitch";

export const Route = createFileRoute("/_app/pitch")({
  component: PitchScreen,
});
