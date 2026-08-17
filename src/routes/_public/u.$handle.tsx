import { createFileRoute } from "@tanstack/react-router";
import { PersonalPageScreen } from "@/features/share/screens/personal-page";

export const Route = createFileRoute("/_public/u/$handle")({
  component: function Page() {
    const { handle } = Route.useParams();
    return <PersonalPageScreen handle={handle} />;
  },
});
