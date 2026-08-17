"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ALLOWANCES,
  PRICES_USD,
  type BillingStatus,
  type Tier,
} from "@/lib/billing/tiers";
import { useT } from "@/lib/i18n/use-t";
import { useBillingCheckout } from "@/lib/query/satellite";
import { cn } from "@/lib/utils";

type PlanView = {
  tier: Tier;
  coachAllowance: number;
  usedThisPeriod: number;
  periodEnd: string | null;
  billingStatus: BillingStatus;
};

const TIER_LABEL = {
  free: "tierFree",
  pro: "tierPro",
  ultra: "tierUltra",
} as const;

const TIERS = ["free", "pro", "ultra"] as const;

/**
 * The three plans, and where this account stands.
 *
 * One panel: current usage, then a row per tier. The filled primary is the
 * next paid step up. Everything else is outline or absent.
 */
export function PlansPanel({ plan }: { plan: PlanView }) {
  const { t, m } = useT();
  const checkout = useBillingCheckout();
  const busy = checkout.isPending;

  const change = async (body: Record<string, unknown>) => {
    try {
      const answer = await checkout.mutateAsync(body);
      if (answer.checkoutUrl) {
        window.location.href = answer.checkoutUrl;
        return;
      }
      if (!answer.ok) {
        toast.error(t(m.billing.unavailable));
        return;
      }
      window.location.reload();
    } catch {
      toast.error(t(m.billing.unavailable));
    }
  };

  const ends = plan.periodEnd?.slice(0, 10) ?? null;
  const used = Math.min(plan.usedThisPeriod, plan.coachAllowance);
  const recommended = TIERS.find(
    (tier) => PRICES_USD[tier] > PRICES_USD[plan.tier],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.billing.title)}</h1>
        <p className="mt-1 text-sm text-foreground">{t(m.billing.lead)}</p>
      </header>

      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">{t(m.billing.currentPlan)}</p>
              <p className="mt-0.5 text-sm font-medium">
                {t(m.billing[TIER_LABEL[plan.tier]])}
              </p>
            </div>
            {plan.billingStatus === "cancelling" && (
              <p className="text-xs text-muted-foreground">{t(m.billing.cancelling)}</p>
            )}
            {plan.billingStatus === "past_due" && (
              <p className="text-xs text-danger">{t(m.billing.pastDue)}</p>
            )}
          </div>

          <div className="mt-3">
            <Progress value={(used / Math.max(1, plan.coachAllowance)) * 100} />
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {m.billing.used(plan.usedThisPeriod, plan.coachAllowance)}
              {ends
                ? ` · ${
                    plan.billingStatus === "cancelling"
                      ? m.billing.endsOn(ends)
                      : m.billing.renewsOn(ends)
                  }`
                : ""}
            </p>
          </div>

          {plan.tier !== "free" && plan.billingStatus !== "cancelling" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="mt-3 -ml-2 text-muted-foreground"
              onClick={() => change({ action: "cancel" })}
            >
              {t(m.billing.cancelPlan)}
            </Button>
          )}
        </div>

        <div className="divide-y divide-border border-t border-border">
          {TIERS.map((tier) => {
            const current = tier === plan.tier;
            const isPrimary = tier === recommended;
            return (
              <div
                key={tier}
                className={cn("flex flex-wrap items-start justify-between gap-3 p-4")}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t(m.billing[TIER_LABEL[tier]])}
                    {current ? (
                      <span className="ms-2 text-xs font-normal text-muted-foreground">
                        {t(m.billing.currentPlan)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {m.billing.perMonth(PRICES_USD[tier])}
                  </p>
                  <p className="mt-2 flex items-baseline gap-1.5 text-xs tabular-nums text-muted-foreground">
                    <Check className="size-3 shrink-0" aria-hidden />
                    {m.billing.turnsPerMonth(ALLOWANCES[tier])}
                  </p>
                </div>
                {!current && (
                  <Button
                    size="sm"
                    variant={isPrimary ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => change({ tier })}
                  >
                    {t(
                      PRICES_USD[tier] > PRICES_USD[plan.tier]
                        ? m.billing.upgrade
                        : m.billing.downgrade,
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
