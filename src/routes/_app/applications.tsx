import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsScreen } from "@/features/application/screens/applications";

export const Route = createFileRoute("/_app/applications")({
  component: ApplicationsScreen,
});
