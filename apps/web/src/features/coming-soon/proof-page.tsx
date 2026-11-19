import { Link } from "@tanstack/react-router"

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

import { ComingSoonPage } from "@/features/coming-soon/coming-soon-page.tsx"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { ProofHeroArt } from "@/features/coming-soon/proof-hero-art.tsx"

export function ProofsPage() {
  return (
    <ComingSoonPage
      header={
        <>
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
        </>
      }
      title={soonCopy.proofTitle}
      body={soonCopy.proofBody}
      topic="proof"
      preview={<ProofHeroArt />}
    />
  )
}
