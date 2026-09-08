import { Button } from "@workspace/ui/components/button"

import type { PaperCite } from "./paper-cite.ts"

export function PaperCiteControl({
  cite,
  onCite,
}: {
  cite: PaperCite
  onCite: (cite: PaperCite) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      data-coach-cite={cite.sectionId}
      aria-label={`Show on Paper: ${cite.label}`}
      onClick={() => onCite(cite)}
      className="h-auto rounded-full px-2 py-0.5 text-2xs text-muted-foreground"
    >
      {cite.label}
    </Button>
  )
}
