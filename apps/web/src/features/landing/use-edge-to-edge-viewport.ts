import { useEffect } from "react"

const EDGE_TO_EDGE = "viewport-fit=cover"

export function useEdgeToEdgeViewport() {
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]'
    )
    if (!viewport || viewport.content.includes(EDGE_TO_EDGE)) return
    const letterboxed = viewport.content
    viewport.content = `${letterboxed}, ${EDGE_TO_EDGE}`
    return () => {
      viewport.content = letterboxed
    }
  }, [])
}
