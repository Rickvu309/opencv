import { currentAccount } from "@/lib/auth/dal";
import { planFor } from "@/lib/billing/plan";
import { PlansPanel } from "./plans";
import { SignInNeeded } from "./sign-in-needed";

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
    return <SignInNeeded />;
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
