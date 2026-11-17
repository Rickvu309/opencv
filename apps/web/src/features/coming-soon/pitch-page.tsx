import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { PageHeaderTitle } from "@workspace/ui/components/page-header"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import "@/features/coming-soon/design/page-header.pen.css"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { useNotify } from "@/features/coming-soon/notify.ts"
import { PitchHeroArt } from "@/features/coming-soon/pitch-hero-art.tsx"

export function PitchPage() {
  const { pending, error, notify } = useNotify("pitch")

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <WorkspaceHeader data-pen-surface="coming-soon">
        <PageHeaderTitle>{soonCopy.pitchPage}</PageHeaderTitle>
      </WorkspaceHeader>
      <div className="@container/pitch flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <div className="relative flex shrink-0 flex-col gap-12 overflow-hidden bg-[radial-gradient(ellipse_55%_65%_at_85%_45%,var(--muted),var(--card))] px-6 py-12 leading-[1.21] xl:@min-[64em]/pitch:block xl:@min-[64em]/pitch:min-h-[700px] xl:@min-[64em]/pitch:flex-1 xl:@min-[64em]/pitch:px-16 xl:@min-[64em]/pitch:pt-[250px]">
          <div className="relative z-10 flex min-w-0 flex-col xl:@min-[64em]/pitch:w-[470px] xl:@min-[64em]/pitch:max-w-full">
            <p className="inline-flex min-h-[26px] w-fit items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[12.5px] font-medium text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-muted-foreground/60"
              />
              {soonCopy.kicker}
            </p>
            <h2 className="mt-5 text-[44px] leading-none font-semibold tracking-[-2px] text-foreground sm:text-[64px] sm:tracking-[-2.8px]">
              {soonCopy.pitchLineOne} <br />
              {soonCopy.pitchLineTwo}
            </h2>
            <p className="mt-[18px] text-[17px] text-muted-foreground/90">
              {soonCopy.pitchBody}
            </p>
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              aria-busy={pending}
              data-primary-action
              onClick={() => void notify()}
              className="mt-8 h-auto min-h-11 w-fit gap-2 rounded-[10px] py-2 ps-4 pe-3.5 text-[14px] md:min-h-10"
            >
              {soonCopy.earlyAccess}
              <ArrowRight aria-hidden="true" className="size-[15px]" />
            </Button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <PitchHeroArt />
        </div>
      </div>
    </div>
  )
}
