import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"

import { soonCopy } from "@/features/coming-soon/copy.ts"
import { useNotify } from "@/features/coming-soon/notify.ts"
import { ProofHeroArt } from "@/features/coming-soon/proof-hero-art.tsx"

export function ProofsPage() {
  const { pending, error, notify } = useNotify("proof")

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-card leading-[1.21]">
      <PageHeader
        title={
          <>
            <Link
              to="/paper"
              className="text-[13.5px] font-normal text-foreground/85 hover:text-foreground"
            >
              Paper
            </Link>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="text-[13.5px]">{soonCopy.proofsPage}</span>
          </>
        }
        className="h-12 border-border/60 bg-background"
      />
      <div className="flex flex-col px-6 pt-8 pb-8 lg:px-16 lg:pt-11 lg:pb-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3.5">
            <p className="inline-flex h-[26px] w-fit items-center gap-1.5 rounded-full border border-border px-2.5 text-[12.5px] font-medium text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-muted-foreground/60"
              />
              {soonCopy.kicker}
            </p>
            <h2 className="text-4xl leading-[1.21] font-semibold tracking-[-0.0375em] text-foreground lg:text-[48px]">
              {soonCopy.proofTitle}
            </h2>
            <p className="text-base leading-[1.21] text-muted-foreground/90">
              {soonCopy.proofBody}
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <Button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void notify()}
              className="h-10 w-fit gap-2 rounded-[10px] bg-foreground pr-3.5 pl-4 text-[14px] font-semibold text-background ring-0 hover:bg-foreground/90 active:bg-foreground/80"
            >
              {soonCopy.earlyAccess}
              <ArrowRight className="size-[15px]" />
            </Button>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-8">
          <ProofHeroArt />
        </div>
      </div>
    </div>
  )
}
