import { createFileRoute, notFound } from "@tanstack/react-router";

import { loadDevTraces } from "@/lib/trace/load";
import { Traces } from "./-traces";

export const Route = createFileRoute("/dev/traces/")({
  beforeLoad: () => {
    if (process.env.NODE_ENV === "production") throw notFound();
  },
  loader: () => loadDevTraces(),
  component: DevTracesPage,
});

function DevTracesPage() {
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-lg font-semibold tracking-tight">Traces</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in first. Traces are scoped to an account, so there is nothing to
          show without one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Traces</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The last {data.traces.length} turns for <code>{data.username}</code>, and
        the last {data.violations.length} guardrail violations. Kept for 14 days.
      </p>
      <Traces traces={data.traces} violations={data.violations} />
    </main>
  );
}
