import { SURFACE_COPY, type SurfaceId } from "@/features/app-shell/surfaces.ts"

export function CraftStub({ surface }: { surface: SurfaceId }) {
  const copy = SURFACE_COPY[surface]

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 p-4 sm:p-6">
      <h1 className="text-page-title font-semibold tracking-tight">{copy.title}</h1>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        {copy.body}
      </p>
    </section>
  )
}
