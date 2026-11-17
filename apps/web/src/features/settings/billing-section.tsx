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
  const planLine =
    data.plan === "pro" ? "You're on the Pro plan." : "You're on the Free plan."

  return (
    <>
      <SettingsTitle title="Billing">{planLine}</SettingsTitle>
      {data.plan === "free" ? (
        <article
          data-slot="settings-plan-card"
          data-card="current-plan"
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5"
        >
          <h2 className="text-[15px] font-medium">Free plan</h2>
          <p className="text-[13px] text-muted-foreground">
            {data.free.price}. {data.free.line}
          </p>
        </article>
      ) : null}
    </>
  )
}
