import { useQuery } from "@tanstack/react-query"

import {
  SettingsLoadError,
  SettingsSection,
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
    return <SettingsLoadError onRetry={() => void billing.refetch()} />
  }

  const data = billing.data
  const planLine =
    data.plan === "pro" ? "You're on the Pro plan." : "You're on the Free plan."

  return (
    <>
      <SettingsTitle title="Billing">{planLine}</SettingsTitle>
      <SettingsSection label="Plan">
        <div className="grid gap-3">
          <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium">Free plan</h3>
            <p className="text-sm text-muted-foreground">
              {data.free.price}. {data.free.line}
            </p>
          </article>
        </div>
      </SettingsSection>
    </>
  )
}
