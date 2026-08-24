const BRAND_IDS = ["gmail", "outlook", "google-calendar"] as const

export type BrandId = (typeof BRAND_IDS)[number]

export const BRAND_META: Record<BrandId, { label: string; src: string }> = {
  gmail: { label: "Gmail", src: "/brands/gmail.svg" },
  outlook: { label: "Outlook", src: "/brands/outlook.svg" },
  "google-calendar": {
    label: "Google Calendar",
    src: "/brands/google-calendar.svg",
  },
}

export function brandLabel(brand: BrandId) {
  return BRAND_META[brand].label
}
