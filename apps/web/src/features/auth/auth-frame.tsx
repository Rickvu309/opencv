import type { ReactNode } from "react"
import { Brand, Mark } from "@workspace/ui/components/brand"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"

import { AUTH_COPY } from "./auth-copy.ts"

export function AuthFrame({
  language,
  onLanguage,
  children,
}: {
  language: "en" | "vi"
  onLanguage: (value: "en" | "vi") => void
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-background text-foreground lg:grid-cols-2">
      <header className="col-start-1 row-start-1 flex items-center px-4 py-4 sm:px-6 lg:col-span-2">
        <Brand size={16} />
      </header>
      <div className="col-start-1 row-start-2 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[340px]">{children}</div>
      </div>
      <div className="hidden min-h-0 flex-col justify-between bg-foreground p-10 text-background lg:col-start-2 lg:row-start-2 lg:flex">
        <div className="flex max-w-sm flex-col gap-3 text-2xl font-semibold">
          <p>{AUTH_COPY.hero1}</p>
          <p>{AUTH_COPY.hero2}</p>
        </div>
        <Mark size={56} className="text-background" />
      </div>
      <SegmentedControl
        aria-label={AUTH_COPY.language}
        className="col-start-1 row-start-1 me-4 self-center justify-self-end sm:me-6 lg:col-span-2"
        size="sm"
        value={language}
        onChange={onLanguage}
        options={[
          { value: "en", label: AUTH_COPY.en },
          { value: "vi", label: AUTH_COPY.vi },
        ]}
      />
    </div>
  )
}
