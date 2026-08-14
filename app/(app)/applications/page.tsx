"use client";

import { ApplicationsKanban } from "./kanban";
import { useApplicationsWorkspace } from "./workspace-parts";

export default function ApplicationsPage() {
  const props = useApplicationsWorkspace();
  return <ApplicationsKanban {...props} />;
}
