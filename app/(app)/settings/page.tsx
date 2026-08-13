import Link from "next/link";

import { currentAccount } from "@/lib/auth/dal";
import { planFor } from "@/lib/billing/plan";
import { PlansPanel } from "./plans";

/**
 * Plans and billing.
 *
 * Server-rendered because the plan is not in `AppState`: it is not the Coach's
 * business and not the browser's to write, so it is read here and handed down
 * as a prop rather than fetched by a client that could be lied to.
 */
export default async function SettingsPage() {
  const account = await currentAccount();
  if (!account) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const plan = await planFor(account.id);

  return (
    <PlansPanel
      plan={{
        tier: plan.tier,
        coachAllowance: plan.coachAllowance,
        usedThisPeriod: plan.usedThisPeriod,
        periodEnd: plan.periodEnd ? plan.periodEnd.toISOString() : null,
        billingStatus: plan.billingStatus,
      }}
    />
  );
}
