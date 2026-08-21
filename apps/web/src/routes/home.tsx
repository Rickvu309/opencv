import { Button } from "@workspace/ui/components/button"
import { brandName } from "@workspace/ui/lib/brand"

export function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{brandName}</h1>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        Personalised AI career coaching. Local scaffold is up.
      </p>
      <Button type="button" variant="outline">
        Continue
      </Button>
    </main>
  )
}
