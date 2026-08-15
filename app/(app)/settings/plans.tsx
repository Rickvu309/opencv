"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ALLOWANCES,
  PRICES_USD,
  type BillingStatus,
  type Tier,
} from "@/lib/billing/tiers";
import { useT } from "@/lib/i18n/use-t";
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

/**
 * The three plans, and where this account stands.
 *
 * The usage bar is the honest part: somebody deciding whether to pay should be
 * looking at how much of the free allowance they actually used, not at a
 * feature grid designed to make the free column look thin.
 */
export function PlansPanel({ plan }: { plan: PlanView }) {
  const { t, m } = useT();
  const [busy, setBusy] = React.useState(false);

  const change = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = await response.json();
      if (answer?.checkoutUrl) {
        window.location.href = answer.checkoutUrl as string;
        return;
      }
      if (!response.ok) {
        // AC-MON-002.3: they stay on the plan they had, and are told so.
        toast.error(t(m.billing.unavailable));
        return;
      }
      window.location.reload();
    } catch {
      toast.error(t(m.billing.unavailable));
    } finally {
      setBusy(false);
    }
  };

  const ends = plan.periodEnd?.slice(0, 10) ?? null;
  const used = Math.min(plan.usedThisPeriod, plan.coachAllowance);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.billing.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(m.billing.lead)}</p>
      </header>

      <section className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{t(m.billing.currentPlan)}</p>
            <p className="mt-0.5 text-sm font-medium">
              {t(m.billing[TIER_LABEL[plan.tier]])}
            </p>
          </div>
          {plan.billingStatus === "cancelling" && (
            <Badge variant="secondary">{t(m.billing.cancelling)}</Badge>
          )}
          {plan.billingStatus === "past_due" && (
            <Badge variant="destructive">{t(m.billing.pastDue)}</Badge>
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
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(["free", "pro", "ultra"] as const).map((tier) => (
          <div
            key={tier}
            className={cn(
              "rounded-xl border bg-card p-4",
              tier === plan.tier && "border-primary",
            )}
          >
            <p className="text-sm font-medium">{t(m.billing[TIER_LABEL[tier]])}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {m.billing.perMonth(PRICES_USD[tier])}
            </p>
            <p className="mt-2 flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
              <Check className="size-3 shrink-0" aria-hidden />
              {m.billing.turnsPerMonth(ALLOWANCES[tier])}
            </p>
            {tier !== plan.tier && (
              <Button
                size="sm"
                variant={tier === "free" ? "ghost" : "default"}
                disabled={busy}
                className="mt-3 w-full"
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
        ))}
      </div>
    </div>
  );
}
