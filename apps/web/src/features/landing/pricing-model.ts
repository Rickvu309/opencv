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
  cta?: string
  note: string
  tone: "neutral" | "white"
  surface: "paper" | "mesh"
  lead?: string
  features: readonly string[]
}

type PricingModel = Omit<
  typeof pricingSnapshot,
  "header" | "plans" | "compare" | "faq"
> & {
  header: { title: string; subhead: string }
  plans: { free: PricingPlan; pro: PricingPlan }
  compare: {
    title: string
    columns: readonly [string, string]
    blocks: readonly {
      label: string
      rows: readonly { feature: string; free: CompareCell; pro: CompareCell }[]
    }[]
  }
  faq: { title: string; items: readonly { q: string; a: string }[] }
}

const NOT_ON_SALE = "Not on sale yet"
const PURCHASE_ONLY_FEATURES = new Set([
  "Unlimited Coach chats",
  "Priority support",
  "Early access to Proof and Pitch",
])
const PURCHASE_ONLY_QUESTIONS = new Set([
  "Can I cancel anytime?",
  "How do I pay?",
  "What is coming to Pro?",
])
const PURCHASE_ONLY_BLOCKS = new Set(["Coming soon"])
const PURCHASE_ONLY_ROWS = new Set(["Priority support"])

function withoutPurchase(plan: PricingPlan): PricingPlan {
  return {
    ...plan,
    cta: undefined,
    note: NOT_ON_SALE,
    features: plan.features.filter(
      (feature) => !PURCHASE_ONLY_FEATURES.has(feature)
    ),
  }
}

function capped(cell: CompareCell): CompareCell {
  return cell.kind === "text" && cell.value === "Unlimited"
    ? { kind: "text", value: "Limited" }
    : cell
}

export const pricingModel: PricingModel = {
  ...pricingSnapshot,
  header: {
    ...pricingSnapshot.header,
    subhead: "Start free. Coach has a daily limit.",
  },
  plans: {
    free: pricingSnapshot.plans.free,
    pro: withoutPurchase(pricingSnapshot.plans.pro),
  },
  compare: {
    ...pricingSnapshot.compare,
    blocks: pricingSnapshot.compare.blocks
      .filter((block) => !PURCHASE_ONLY_BLOCKS.has(block.label))
      .map((block) => ({
        label: block.label,
        rows: block.rows
          .filter((row) => !PURCHASE_ONLY_ROWS.has(row.feature))
          .map((row) => ({ ...row, pro: capped(row.pro) })),
      })),
  },
  faq: {
    ...pricingSnapshot.faq,
    items: pricingSnapshot.faq.items.filter(
      (item) => !PURCHASE_ONLY_QUESTIONS.has(item.q)
    ),
  },
}

export function pricingDescription(model: PricingModel): string {
  const { free, pro } = model.plans
  return `${model.header.subhead} ${free.name} is ${free.price} a month. ${pro.name} is ${pro.price} a month.`
}
