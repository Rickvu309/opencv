import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { GET as getHandler, POST as postHandler } from "./-handlers";

const GET = createServerOnlyFn(getHandler);
const POST = createServerOnlyFn(postHandler);

export const Route = createFileRoute("/api/trace/")({
  server: {
    handlers: {
      GET: () => GET(),
      POST: ({ request }) => POST(request),
    },
  },
});
