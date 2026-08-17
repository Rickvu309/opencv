import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import PaperPage from "./-page";

export const Route = createFileRoute("/_signed-in/paper/")({
  validateSearch: z.object({
    id: z.string().optional(),
    new: z.enum(["cv", "letter"]).optional(),
    format: z.literal("1").optional(),
    arrange: z.literal("1").optional(),
    from: z.literal("upload").optional(),
  }),
  component: PaperPage,
});
