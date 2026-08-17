import { createFileRoute } from "@tanstack/react-router";
import { ProofEditorScreen } from "@/features/proof/screens/editor";

export const Route = createFileRoute("/_app/proof/$proofId")({
  component: function ProofRoute() {
    const { proofId } = Route.useParams();
    return <ProofEditorScreen proofId={proofId} />;
  },
});
