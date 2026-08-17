import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import CoachPage from "../(app)/coach/page";

export const Route = createFileRoute("/_app/coach")({
  validateSearch: z.object({
    q: z.string().optional(),
  }),
  component: CoachPage,
});
