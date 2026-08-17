import { createServerFn } from "@tanstack/react-start";

import { currentAccount } from "@/lib/auth/dal";
import { recentTraces, recentViolations } from "./store";

export const loadDevTraces = createServerFn({ method: "GET" }).handler(
  async () => {
    const account = await currentAccount();
    if (!account) return { signedIn: false as const };
    const [traces, violations] = await Promise.all([
      recentTraces(account.id),
      recentViolations(account.id),
    ]);
    return {
      signedIn: true as const,
      username: account.username,
      traces,
      violations,
    };
  },
);
