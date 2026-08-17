import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { GET as getHandler } from "./-handlers";

const GET = createServerOnlyFn(getHandler);

export const Route = createFileRoute("/api/cron/")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});
