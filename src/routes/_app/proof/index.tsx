import { createFileRoute } from "@tanstack/react-router";
import { ProofListScreen } from "@/features/proof/screens/list";

export const Route = createFileRoute("/_app/proof/")({
  component: ProofListScreen,
});
