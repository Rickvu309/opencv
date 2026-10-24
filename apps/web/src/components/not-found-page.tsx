export function NotFoundPage({
  description = "This page does not exist.",
}: {
  description?: string
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Not Found</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        {description}
      </p>
    </main>
  )
}
