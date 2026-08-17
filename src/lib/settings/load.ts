import { createServerFn } from "@tanstack/react-start";

import { currentAccount } from "@/lib/auth/dal";
import { planFor } from "@/lib/billing/plan";
import { defaultHandle, readSiteForAccount } from "@/lib/paper/share";
import { readAccountState } from "@/lib/state/account-state";

export const loadSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const account = await currentAccount();
    if (!account) return { signedIn: false as const };

    const plan = await planFor(account.id);
    const site = await readSiteForAccount(account.id);
    const state = await readAccountState(account.id);
    const handle =
      site?.handle ??
      defaultHandle(
        state?.profile.identity.name || account.username,
        account.id,
      );

    return {
      signedIn: true as const,
      handle,
      plan: {
        tier: plan.tier,
        coachAllowance: plan.coachAllowance,
        usedThisPeriod: plan.usedThisPeriod,
        periodEnd: plan.periodEnd ? plan.periodEnd.toISOString() : null,
        billingStatus: plan.billingStatus,
      },
    };
  },
);
