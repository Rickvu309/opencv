import { useEffect, useLayoutEffect, useReducer, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { wordPageSchema, type WordPage } from "@workspace/domain"

import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { syncParagraphs } from "../paper-page/canvas-draw.ts"
import { pageBlocks } from "../paper-page/canvas-edit.ts"
import { collectLooks } from "../paper-page/canvas-look.ts"
import "../paper-page/canvas.css"
import "./design/paper-picture.css"

function FirstPage({ page }: { page: WordPage }) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!root.current) return
    const blocks = pageBlocks(page)
    syncParagraphs(
      root.current,
      blocks,
      collectLooks(new Map(), blocks),
      {
        blockId: blocks[0]?.id ?? "",
        offset: 0,
      },
      new Map()
    )
    for (const paragraph of root.current.querySelectorAll("p"))
      paragraph.removeAttribute("contenteditable")
  }, [page])
  return (
    <div
      inert
      data-slot="paper-word-first-page"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        ref={root}
        className="writing-page paper-picture-text"
        style={{
          backgroundColor: "transparent",
          borderWidth: 0,
          boxShadow: "none",
          color: "inherit",
        }}
      />
    </div>
  )
}

export function PaperWordPreview({ docId }: { docId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, markVisible] = useReducer(
    () => true,
    typeof IntersectionObserver === "undefined"
  )
  const { data: session } = authClient.useSession()
  const owner = session?.user.id ?? ""
  useEffect(() => {
    if (visible || !host.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markVisible()
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [visible])
  const query = useQuery({
    ...catalogClient.options(owner, "paper.read", { view: "page", docId }),
    enabled: visible && owner !== "",
    staleTime: 60_000,
    retry: false,
  })
  const parsed = wordPageSchema.safeParse(query.data)
  return (
    <div
      ref={host}
      data-slot="paper-word-preview"
      className="absolute inset-0"
      aria-hidden="true"
    >
      {parsed.success ? (
        <FirstPage page={parsed.data} />
      ) : query.isError || query.isSuccess ? (
        <span className="flex h-full items-center justify-center px-4 text-center text-xs text-black/65">
          Preview unavailable
        </span>
      ) : (
        <span
          data-slot="paper-preview-loading"
          className="flex flex-col gap-2 p-[12%]"
        >
          <span className="mb-2 h-2 w-2/3 rounded-sm bg-black/10" />
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className="h-1 rounded-sm bg-black/10" />
          ))}
        </span>
      )}
    </div>
  )
}
