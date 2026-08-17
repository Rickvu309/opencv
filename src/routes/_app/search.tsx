import { createFileRoute } from "@tanstack/react-router";
import { SearchScreen } from "@/features/search/screens/search";

export const Route = createFileRoute("/_app/search")({
  component: SearchScreen,
});
