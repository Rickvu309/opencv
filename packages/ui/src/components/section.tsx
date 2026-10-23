import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/** Centers page content at the marketing max width with responsive gutters. */
function SectionContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-container"
      className={cn("mx-auto w-full max-w-[1344px] px-4 md:px-8", className)}
      {...props}
    />
  )
}

/** A marketing page section: vertical rhythm plus a contained inner column. */
function Section({
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"section"> & { containerClassName?: string }) {
  return (
    <section
      data-slot="section"
      className={cn("py-16 md:py-32", className)}
      {...props}
    >
      <SectionContainer className={containerClassName}>
        {children}
      </SectionContainer>
    </section>
  )
}

export { Section, SectionContainer }
