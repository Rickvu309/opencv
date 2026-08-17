import { createHmac, timingSafeEqual } from "node:crypto";
import { failure } from "@/lib/auth/http";
import { cancel, isTier, markPastDue, setTier } from "@/lib/billing/plan";

/**
 * The provider telling us what actually happened.
 *
 * The authority on billing is the provider, not this app: a user's tier is
 * whatever the last verified webhook said it is. That is why checkout does not
 * set a tier and this does.
 *
 * ## Verification is not optional
 *
 * An unauthenticated webhook is a public endpoint that grants paid plans. The
 * signature is checked before the body is read as anything but bytes, and a
 * missing secret is a refusal rather than a bypass, for the same reason as the
 * cron route: an endpoint that is open when misconfigured is open on the day it
 * matters.
 */
export async function POST(request: Request) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) return failure("no-session", 401);

  const raw = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return failure("no-session", 401);
  }

  let event: {
    type?: string;
    accountId?: string;
    tier?: string;
    subscriptionId?: string;
    periodEnd?: string;
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return failure("bad-request", 400);
  }

  const accountId = event.accountId;
  if (typeof accountId !== "string") return failure("bad-request", 400);

  try {
    switch (event.type) {
      // AC-MON-002.2 and AC-MON-005.1.
      case "subscription.active":
      case "subscription.renewed": {
        if (!isTier(event.tier) || event.tier === "free") {
          return failure("bad-request", 400);
        }
        await setTier(accountId, event.tier, {
          providerSubscriptionId: event.subscriptionId ?? null,
          periodEnd: event.periodEnd ? new Date(event.periodEnd) : null,
          billingStatus: "active",
        });
        break;
      }
      // AC-MON-005.2: a failed renewal is not an immediate downgrade. The
      // provider retries, and the plan reverts when the subscription actually
      // ends, which `rollIfExpired` does at the period boundary.
      case "payment.failed":
        await markPastDue(accountId);
        break;
      case "subscription.cancelled":
        await cancel(accountId);
        break;
      default:
        // Unknown events are acknowledged, not errored: a provider that gets a
        // 400 will retry forever for an event we were never going to act on.
        break;
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("billing webhook failed", error);
    return failure("store-down", 502);
  }
}
