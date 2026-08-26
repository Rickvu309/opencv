/**
 * Single coming-soon affordance. Use on disabled controls instead of
 * ad-hoc opacity, title-only, or inline copy.
 *
 * Visible suffix for text actions; `silent` for icon-only controls that
 * already expose "coming soon" in their accessible name.
 */
export function ComingSoon({ silent = false }: { silent?: boolean }) {
  if (silent) {
    return <span className="sr-only">Coming soon</span>
  }
  return <span className="text-muted-foreground"> · Coming soon</span>
}

export function comingSoonLabel(name: string) {
  return `${name} — coming soon`
}
