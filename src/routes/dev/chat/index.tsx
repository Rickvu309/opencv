import { createFileRoute, notFound } from "@tanstack/react-router";

import { scenarios } from "@/lib/coach/fixture";
import { DevChatScenarios } from "./-scenarios";

export const Route = createFileRoute("/dev/chat/")({
  beforeLoad: () => {
    if (process.env.NODE_ENV === "production") throw notFound();
  },
  component: DevChatPage,
});

function DevChatPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Chat states</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Fixtures from <code>lib/coach/fixture.ts</code>. No model, no tokens, no
        waiting.
      </p>
      <DevChatScenarios scenarios={scenarios} />
    </main>
  );
}
