import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { POST as postHandler, DELETE as deleteHandler } from "./-handlers";

const POST = createServerOnlyFn(postHandler);
const DELETE = createServerOnlyFn(deleteHandler);

export const Route = createFileRoute("/api/proof-share/")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
      DELETE: ({ request }) => DELETE(request),
    },
  },
});
