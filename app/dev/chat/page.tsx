// Every state the thread can be in, on one screen, with no model behind it.
//
// A live turn costs the better part of a minute and real NVIDIA tokens, and the
// states most worth looking at are the ones you cannot ask for: a refused call,
// a payload the schema rejected, a turn that reasons for a minute and says
// nothing. Judging a change to the thread against whichever of those the model
// happened to produce today is how the rendering drifts.
//
// Development only. `notFound()` in production keeps it out of the build's
// reachable routes, and the fixtures it renders are not imported anywhere else
// in the app.

import { notFound } from "next/navigation";

import { scenarios } from "@/lib/coach/fixture";
import { DevChatScenarios } from "./scenarios";

export default function DevChatPage() {
  if (process.env.NODE_ENV === "production") notFound();

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
