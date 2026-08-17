import { createFileRoute } from "@tanstack/react-router";

import PitchPage from "../(app)/pitch/page";

export const Route = createFileRoute("/_app/pitch")({
  component: PitchPage,
});
