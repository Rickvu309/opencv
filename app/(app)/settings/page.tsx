import { currentAccount } from "@/lib/auth/dal";
import { planFor } from "@/lib/billing/plan";
import { defaultHandle, readSiteForAccount } from "@/lib/paper/share";
import { readAccountState } from "@/lib/state/account-state";
import { HandlePanel } from "./handle";
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
  const site = await readSiteForAccount(account.id);
  const state = await readAccountState(account.id);
  const handle =
    site?.handle ??
    defaultHandle(state?.profile.identity.name || account.username, account.id);

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl px-5 pt-8 sm:px-8">
        <HandlePanel initial={handle} />
      </div>
      <PlansPanel
        plan={{
          tier: plan.tier,
          coachAllowance: plan.coachAllowance,
          usedThisPeriod: plan.usedThisPeriod,
          periodEnd: plan.periodEnd ? plan.periodEnd.toISOString() : null,
          billingStatus: plan.billingStatus,
        }}
      />
    </div>
  );
}
