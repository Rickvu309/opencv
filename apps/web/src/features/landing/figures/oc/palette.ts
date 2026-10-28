import type { ComponentType, CSSProperties } from "react"

/** The app's own greys and accents, mapped onto the stock shadcn variables. */
export const OC = {
  shell: "var(--sidebar)",
  panel: "var(--card)",
  subtle: "var(--background)",
  border: "var(--border)",
  text: "var(--foreground)",
  body: "var(--muted-foreground)",
  secondary: "var(--muted-foreground)",
  muted: "var(--chart-5)",
  icon: "var(--muted-foreground)",
  pin: "var(--chart-1)",
  amber: "var(--chart-4)",
  green: "var(--chart-2)",
  indigo: "var(--chart-3)",
  orange: "var(--chart-4)",
}

export type IconType = ComponentType<{
  size?: number
  strokeWidth?: number
  color?: string
  fill?: string
}>

/** Entrance stagger delay, read by .oc-in-left / .oc-in-up in app-shell.css. */
export const delay = (ms: number) =>
  ({ ["--landing-delay" as string]: `${ms}ms` }) as CSSProperties

/** Clips text that types and backspaces inside its own box. */
export const clip: CSSProperties = {
  display: "inline-block",
  overflow: "hidden",
  whiteSpace: "nowrap",
}
