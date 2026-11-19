import { useQuery } from "@tanstack/react-query"

import {
  SettingsLoadError,
  SettingsSkeletons,
  SettingsTitle,
} from "./settings-layout.tsx"
import { billingKey, fetchBilling } from "@/lib/account-api.ts"

export function BillingSection() {
  const billing = useQuery({
    queryKey: billingKey(),
    queryFn: fetchBilling,
  })

  if (billing.isPending) {
    return (
      <>
        <SettingsTitle title="Billing" />
        <SettingsSkeletons />
      </>
    )
  }
  if (billing.isError || !billing.data) {
    return (
      <>
        <SettingsTitle title="Billing" />
        <SettingsLoadError onRetry={() => void billing.refetch()} />
      </>
    )
  }

  const data = billing.data
  const plan = PLAN_NAMES[data.plan]
  const current = data[data.plan]

  return (
    <>
      <SettingsTitle title="Billing">You're on the {plan}.</SettingsTitle>
      <article
        data-slot="settings-plan-card"
        data-card="current-plan"
        className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5"
      >
        <h2 className="text-[15px] font-medium">{plan}</h2>
        <p className="text-[13px] text-muted-foreground">
          {current.price}. {current.line}
        </p>
      </article>
    </>
  )
}

const PLAN_NAMES = {
  free: "Free plan",
  pro: "Pro plan",
} as const
