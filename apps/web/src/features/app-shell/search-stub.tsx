import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import {
  SEARCH_STUB_COPY,
  SURFACE_PATHS,
} from "@/features/app-shell/surfaces.ts"

export function SearchStub() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceHeader
        title={SEARCH_STUB_COPY.title}
        description={SEARCH_STUB_COPY.body}
      />
      <section className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-4 py-10 sm:px-6">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {SEARCH_STUB_COPY.detail}
        </p>
        <div>
          <Button
            type="button"
            onClick={() => {
              void navigate({ to: SURFACE_PATHS.apply })
            }}
          >
            {SEARCH_STUB_COPY.cta}
          </Button>
        </div>
      </section>
    </div>
  )
}
