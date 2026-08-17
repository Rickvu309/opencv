import { createFileRoute } from "@tanstack/react-router";

import HelpPage from "../(app)/help/page";

export const Route = createFileRoute("/_app/help")({
  component: HelpPage,
});
