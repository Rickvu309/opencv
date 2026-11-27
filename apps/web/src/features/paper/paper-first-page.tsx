import { useEffect, useRef } from "react"

import type { LayoutPage } from "@workspace/domain/paper-doc"

export function PaperFirstPage({ page }: { page: LayoutPage }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const stage = host.current!
    let erase: (() => void) | undefined
    let gone = false
    void import("./editor/thumbnail.ts").then(({ paintThumbnail }) => {
      if (!gone) erase = paintThumbnail(stage, page)
    })
    return () => {
      gone = true
      erase?.()
    }
  }, [page])
  return <div ref={host} data-slot="paper-first-page" aria-hidden="true" />
}
