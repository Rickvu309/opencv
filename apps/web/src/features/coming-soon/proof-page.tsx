import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  PageHeaderBack,
  PageHeaderLeading,
} from "@workspace/ui/components/page-header"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import "@/features/coming-soon/design/page-header.css"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { useNotify } from "@/features/coming-soon/notify.ts"
import { ProofHeroArt } from "@/features/coming-soon/proof-hero-art.tsx"

export function ProofsPage() {
  const { pending, error, notify } = useNotify("proof")

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card leading-[1.21]">
      <WorkspaceHeader data-surface="coming-soon">
        <PageHeaderLeading>
          <PageHeaderBack render={<Link to="/paper" />}>Paper</PageHeaderBack>
        </PageHeaderLeading>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link to="/paper" />}
                className="inline-flex min-h-11 items-center md:min-h-6"
              >
                Paper
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage as="h1">{soonCopy.proofsPage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </WorkspaceHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-6 pt-8 pb-8 lg:px-16 lg:pt-11 lg:pb-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3.5">
            <p className="inline-flex min-h-[26px] w-fit items-center gap-1.5 rounded-full border border-border px-2.5 text-[12.5px] font-medium text-muted-foreground">
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
              variant="primary"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void notify()}
              className="h-auto min-h-11 w-fit max-w-full gap-2 rounded-[10px] py-2 ps-4 pe-3.5 text-[14px] whitespace-normal md:min-h-10"
            >
              {soonCopy.earlyAccess}
              <ArrowRight aria-hidden="true" className="size-[15px]" />
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
