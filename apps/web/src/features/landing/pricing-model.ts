import { pricingSnapshot } from "./design/pricing.snapshot.ts"

export type IncludedIconName = "file-text" | "kanban" | "calendar" | "plug"

export type PricingPlan = {
  name: string
  audience: string
  price: string
  period: string
  cta: string
  note: string
  tone: "neutral"
  features: readonly string[]
}

type PricingModel = Pick<typeof pricingSnapshot, "metrics" | "included"> & {
  header: { title: string; subhead: string }
  plan: PricingPlan
  faq: { title: string; items: readonly { q: string; a: string }[] }
}

const TIERED_FEATURES = new Set(["Basic Coach model"])
const PURCHASE_ONLY_QUESTIONS = new Set([
  "Can I cancel anytime?",
  "How do I pay?",
  "What is coming to Pro?",
])

const free = pricingSnapshot.plans.free

export const pricingModel: PricingModel = {
  metrics: pricingSnapshot.metrics,
  included: pricingSnapshot.included,
  header: {
    ...pricingSnapshot.header,
    subhead: "Start free. Coach has a daily limit.",
  },
  plan: {
    name: free.name,
    audience: free.audience,
    price: free.price,
    period: free.period,
    cta: free.cta,
    note: free.note,
    tone: free.tone,
    features: free.features.filter((feature) => !TIERED_FEATURES.has(feature)),
  },
  faq: {
    ...pricingSnapshot.faq,
    items: pricingSnapshot.faq.items.filter(
      (item) => !PURCHASE_ONLY_QUESTIONS.has(item.q)
    ),
  },
}

export function pricingDescription(model: PricingModel): string {
  const { plan } = model
  return `${model.header.subhead} ${plan.name} is ${plan.price} a month.`
}
