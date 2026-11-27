import { useEffect, useRef } from "react"

import type { LayoutPage } from "@workspace/domain/paper-doc"

import { paintThumbnail } from "./editor/thumbnail.ts"

export function PaperFirstPage({ page }: { page: LayoutPage }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => paintThumbnail(host.current!, page), [page])
  return <div ref={host} data-slot="paper-first-page" aria-hidden="true" />
}
