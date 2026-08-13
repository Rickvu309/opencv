import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { cancel, isTier, setTier, PRICES_USD } from "@/lib/billing/plan";

/**
 * Starting a subscription, changing one, or cancelling.
 *
 * ## Why there is no card here
 *
 * The blueprint's ADR delegates payment, and this takes that literally: no card
 * number reaches this process, and the only thing stored is the provider's
 * subscription reference. What this route does is decide *what* the user is
 * asking for and hand off.
 *
 * ## The provider, and what happens without one
 *
 * `BILLING_CHECKOUT_URL` points at the provider's hosted checkout. When it is
 * unset the route refuses rather than pretending: a checkout that silently
 * succeeds without taking money would put somebody on a paid tier they are not
 * paying for, and the first anybody would know is the invoice that never came.
 *
 * The one exception is a downgrade to free, which takes no money and therefore
 * needs no provider.
 */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);

  if (body.action === "cancel") {
    // AC-MON-003.2: the allowance stays until the period ends.
    const plan = await cancel(account.id);
    return NextResponse.json({ ok: true, plan: { tier: plan.tier, billingStatus: plan.billingStatus } });
  }

  if (!isTier(body.tier)) return failure("bad-request", 400);
  if (body.tier === "free") {
    const plan = await setTier(account.id, "free");
    return NextResponse.json({ ok: true, plan: { tier: plan.tier } });
  }

  const base = process.env.BILLING_CHECKOUT_URL;
  if (!base) {
    // AC-MON-002.3, in the form it takes before a provider is connected: the
    // user stays on their plan and is told the change did not take effect.
    return failure("billing-unavailable", 503);
  }

  const url = new URL(base);
  url.searchParams.set("tier", body.tier);
  url.searchParams.set("price", String(PRICES_USD[body.tier]));
  // The provider hands this back on the webhook, which is how the payment is
  // tied to an account without trusting anything the browser says.
  url.searchParams.set("client_reference_id", account.id);
  return NextResponse.json({ ok: true, checkoutUrl: url.toString() });
}
