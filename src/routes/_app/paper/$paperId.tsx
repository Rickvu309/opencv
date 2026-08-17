import { createFileRoute } from "@tanstack/react-router";
import { PaperEditorScreen } from "@/features/paper/screens/editor";

export const Route = createFileRoute("/_app/paper/$paperId")({
  component: function PaperRoute() {
    const { paperId } = Route.useParams();
    return <PaperEditorScreen paperId={paperId} />;
  },
});
