import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { POST as postHandler } from "./-handlers";

const POST = createServerOnlyFn(postHandler);

export const Route = createFileRoute("/api/auth/sign-out/")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
