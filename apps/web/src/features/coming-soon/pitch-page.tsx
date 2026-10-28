import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"

import { soonCopy } from "@/features/coming-soon/copy.ts"
import { useNotify } from "@/features/coming-soon/notify.ts"
import { PitchHeroArt } from "@/features/coming-soon/pitch-hero-art.tsx"

export function PitchPage() {
  const { pending, error, notify } = useNotify("pitch")

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-background">
      <PageHeader
        title={<span className="text-[13.5px]">{soonCopy.pitchPage}</span>}
        className="h-12 bg-background"
      />
      <div className="relative flex flex-col gap-12 overflow-hidden bg-[radial-gradient(ellipse_55%_65%_at_85%_45%,var(--muted),var(--card))] px-6 py-12 leading-[1.21] xl:block xl:min-h-[700px] xl:flex-1 xl:p-0">
        <div className="flex flex-col xl:absolute xl:top-[250px] xl:left-16">
          <p className="inline-flex h-[26px] w-fit items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[12.5px] font-medium text-muted-foreground">
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
            disabled={pending}
            aria-busy={pending}
            onClick={() => void notify()}
            className="mt-8 h-10 w-fit gap-2 rounded-[10px] bg-foreground pr-3.5 pl-4 text-[14px] font-semibold text-background ring-0 hover:bg-foreground/90"
          >
            {soonCopy.earlyAccess}
            <ArrowRight className="size-[15px]" />
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
  )
}
