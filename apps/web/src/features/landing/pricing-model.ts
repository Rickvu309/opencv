import { pricingSnapshot } from "./design/pricing.snapshot.ts"

export const COMPARE_LABEL = {
  check: "Included",
  dash: "Not included",
} as const

export type IncludedIconName = "file-text" | "kanban" | "calendar" | "plug"

export type CompareCell =
  | { kind: "check" }
  | { kind: "dash" }
  | {
      kind: "text"
      value:
        "Limited" | "Unlimited" | "Basic" | "Stronger" | "All" | "Early access"
    }

export type PricingPlan = {
  name: string
  kicker?: string
  audience: string
  price: string
  period: string
  cta: string
  note: string
  tone: "neutral" | "white"
  surface: "paper" | "mesh"
  lead?: string
  features: readonly string[]
}

type PricingModel = Omit<typeof pricingSnapshot, "plans" | "compare"> & {
  plans: { free: PricingPlan; pro: PricingPlan }
  compare: {
    title: string
    columns: readonly [string, string]
    blocks: readonly {
      label: string
      rows: readonly { feature: string; free: CompareCell; pro: CompareCell }[]
    }[]
  }
}

export const pricingModel: PricingModel = pricingSnapshot

export function pricingDescription(model: PricingModel): string {
  const { free, pro } = model.plans
  return `${model.header.subhead} ${free.name} is ${free.price} a month. ${pro.name} is ${pro.price} a month.`
}
