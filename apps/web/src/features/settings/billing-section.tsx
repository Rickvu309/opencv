import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"

import {
  SettingsCard,
  SettingsLoadError,
  SettingsRow,
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
      <article
        data-slot="settings-plan-card"
        data-card="pro-plan"
        className="mt-3 flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-medium">Upgrade to Pro</h2>
          <p className="text-[13px] text-muted-foreground">
            {data.pro.price}. {data.pro.line}
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 border-t border-border pt-4 text-[13px] sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-2">
          {data.pro.benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <Check aria-hidden className="size-3.5 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
      </article>
      <SettingsSection
        id="payment"
        label="Payment"
        spacing="grid"
        className="mt-8"
      >
        <SettingsCard name="payment">
          <SettingsRow
            id="payment-method"
            inset="wide"
            label="Payment method"
            desc="No card added"
          />
          <SettingsRow
            id="invoices"
            inset="wide"
            label="Invoices"
            desc="None yet"
          />
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
