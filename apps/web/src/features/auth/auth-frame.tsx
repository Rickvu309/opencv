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
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Brand size={16} />
        <SegmentedControl
          aria-label={AUTH_COPY.language}
          size="sm"
          value={language}
          onChange={onLanguage}
          options={[
            { value: "en", label: AUTH_COPY.en },
            { value: "vi", label: AUTH_COPY.vi },
          ]}
        />
      </header>
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[340px]">{children}</div>
        </div>
        <div className="hidden min-h-0 flex-col justify-between bg-foreground p-10 text-background lg:flex">
          <div className="flex max-w-sm flex-col gap-3 text-2xl font-semibold">
            <p>{AUTH_COPY.hero1}</p>
            <p>{AUTH_COPY.hero2}</p>
          </div>
          <Mark size={56} className="text-background" />
        </div>
      </div>
    </div>
  )
}
