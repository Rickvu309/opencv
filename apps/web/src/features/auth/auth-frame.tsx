import type { ReactNode } from "react"
import { Mark } from "@workspace/ui/components/brand"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"

import { AUTH_COPY } from "./auth-copy.ts"
import { AuthShaderPanel } from "./auth-shader-panel.tsx"

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
    <main
      data-auth-frame
      className="grid min-h-dvh bg-background text-foreground lg:grid-cols-2"
    >
      <div
        data-layout-section="Left"
        className="grid min-h-dvh grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] items-center px-8 py-7"
      >
        <div
          data-region="brand"
          className="col-start-1 row-start-1 inline-flex items-center gap-2 justify-self-start text-[15px] font-semibold tracking-[-0.5px]"
        >
          <Mark size={15} />
          <span>opencv</span>
        </div>
        <div
          data-region="form"
          className="col-span-2 row-start-2 w-full max-w-[340px] justify-self-center"
        >
          {children}
        </div>
        <p
          data-region="terms"
          className="col-span-2 row-start-3 text-center text-xs text-muted-foreground"
        >
          {AUTH_COPY.terms}
        </p>
        <div className="relative col-start-2 row-start-1 justify-self-end">
          <SegmentedControl
            aria-label={AUTH_COPY.language}
            className="[&_[role=radio]]:min-h-11 [&_[role=radio]]:min-w-11 md:[&_[role=radio]]:min-h-0 md:[&_[role=radio]]:min-w-0"
            value={language}
            onChange={onLanguage}
            options={[
              { value: "en", label: AUTH_COPY.en },
              { value: "vi", label: AUTH_COPY.vi },
            ]}
          />
          <p
            role="status"
            className="absolute end-0 w-[260px] max-w-[calc(100vw-64px)] text-end text-xs text-pretty text-muted-foreground [inset-block-start:100%] [margin-block-start:0.5rem]"
          >
            {language === "vi" ? AUTH_COPY.vietnameseNotice : ""}
          </p>
        </div>
      </div>
      <AuthShaderPanel />
    </main>
  )
}
