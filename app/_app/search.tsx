import { createFileRoute } from "@tanstack/react-router";

import SearchPage from "../(app)/search/page";

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
});
