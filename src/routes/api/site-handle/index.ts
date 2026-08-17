import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { GET as getHandler, PUT as putHandler } from "./-handlers";

const GET = createServerOnlyFn(getHandler);
const PUT = createServerOnlyFn(putHandler);

export const Route = createFileRoute("/api/site-handle/")({
  server: {
    handlers: {
      GET: () => GET(),
      PUT: ({ request }) => PUT(request),
    },
  },
});
