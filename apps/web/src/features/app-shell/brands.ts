export const BRAND_META = {
  gmail: { label: "Gmail", src: "/brands/gmail.svg" },
  outlook: { label: "Outlook", src: "/brands/outlook.svg" },
  "google-calendar": {
    label: "Google Calendar",
    src: "/brands/google-calendar.svg",
  },
}

export type BrandId = keyof typeof BRAND_META

export function brandLabel(brand: BrandId) {
  return BRAND_META[brand].label
}
