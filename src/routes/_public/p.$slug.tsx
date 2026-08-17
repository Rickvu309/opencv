import { createFileRoute } from "@tanstack/react-router";
import { ProofPageScreen } from "@/features/share/screens/proof-page";

export const Route = createFileRoute("/_public/p/$slug")({
  component: function Page() {
    const { slug } = Route.useParams();
    return <ProofPageScreen slug={slug} />;
  },
});
