import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import PaperPage from "../(app)/paper/page";

export const Route = createFileRoute("/_app/paper")({
  validateSearch: z.object({
    id: z.string().optional(),
    new: z.enum(["cv", "letter"]).optional(),
    format: z.string().optional(),
    arrange: z.string().optional(),
    from: z.string().optional(),
  }),
  component: PaperPage,
});
