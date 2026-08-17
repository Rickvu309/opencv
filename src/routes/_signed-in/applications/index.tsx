import { createFileRoute } from "@tanstack/react-router";

import { ApplicationsKanban } from "./-kanban";
import { useApplicationsWorkspace } from "./-workspace-parts";

export const Route = createFileRoute("/_signed-in/applications/")({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const props = useApplicationsWorkspace();
  return <ApplicationsKanban {...props} />;
}
