import { createFileRoute } from "@tanstack/react-router";

import ApplicationsPage from "../(app)/applications/page";

export const Route = createFileRoute("/_app/applications")({
  component: ApplicationsPage,
});
