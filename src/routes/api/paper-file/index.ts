import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { GET as getHandler, PUT as putHandler, DELETE as deleteHandler } from "./-handlers";

const GET = createServerOnlyFn(getHandler);
const PUT = createServerOnlyFn(putHandler);
const DELETE = createServerOnlyFn(deleteHandler);

export const Route = createFileRoute("/api/paper-file/")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
      PUT: ({ request }) => PUT(request),
      DELETE: ({ request }) => DELETE(request),
    },
  },
});
