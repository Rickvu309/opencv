// What the Coach did lately, and what the guards stopped.
//
// Development only, matching `app/dev/chat`: `notFound()` in production keeps
// it out of the build's reachable routes. The production way to look at this is
// `GET /api/trace`, which returns the same data as JSON to whoever's session
// asks for it.
//
// English, no i18n. This is an operator's screen, not a user's.

import { notFound } from "next/navigation";

import { currentAccount } from "@/lib/auth/dal";
import { recentTraces, recentViolations } from "@/lib/trace/store";
import { Traces } from "./traces";

export default async function DevTracesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const account = await currentAccount();
  if (!account) {
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

  const [traces, violations] = await Promise.all([
    recentTraces(account.id),
    recentViolations(account.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Traces</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The last {traces.length} turns for <code>{account.username}</code>, and
        the last {violations.length} guardrail violations. Kept for 14 days.
      </p>

      <Traces traces={traces} violations={violations} />
    </main>
  );
}
