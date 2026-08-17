import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { GET as getHandler, POST as postHandler, PUT as putHandler } from "./-handlers";

const GET = createServerOnlyFn(getHandler);
const POST = createServerOnlyFn(postHandler);
const PUT = createServerOnlyFn(putHandler);

export const Route = createFileRoute("/api/coach/conversations/")({
  server: {
    handlers: {
      GET: () => GET(),
      POST: ({ request }) => POST(request),
      PUT: ({ request }) => PUT(request),
    },
  },
});
