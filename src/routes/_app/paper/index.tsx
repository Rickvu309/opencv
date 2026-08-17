import { createFileRoute } from "@tanstack/react-router";
import { PaperListScreen } from "@/features/paper/screens/list";

export const Route = createFileRoute("/_app/paper/")({
  component: PaperListScreen,
});
