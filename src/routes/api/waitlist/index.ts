import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { POST as postHandler } from "./-handlers";

const POST = createServerOnlyFn(postHandler);

export const Route = createFileRoute("/api/waitlist/")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
