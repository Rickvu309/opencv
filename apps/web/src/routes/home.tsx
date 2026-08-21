import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { brandName } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { apiBaseUrl, fetchHealth } from "@/lib/api.ts"

function ApiHealth() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
  })

  const { label, dot } = health.isPending
    ? { label: "Checking the API", dot: "bg-current opacity-40" }
    : health.data?.ok
      ? { label: "API reachable", dot: "bg-emerald-500" }
      : { label: "API unreachable", dot: "bg-destructive" }

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
      <span>{label}</span>
      <span className="font-mono text-xs opacity-70">{apiBaseUrl}</span>
    </p>
  )
}

export function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{brandName}</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Personalised AI career coaching. Local scaffold is up.
      </p>
      <ApiHealth />
      <Button type="button" variant="outline">
        Continue
      </Button>
    </main>
  )
}
