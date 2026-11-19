import { useEffect, useReducer, type RefObject } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

type Heading = { element: HTMLElement; text: string }

export function PaperDocumentOutline({
  host,
}: {
  host: RefObject<HTMLDivElement | null>
}) {
  const [headings, setHeadings] = useReducer(
    (previous: Heading[], next: Heading[]) =>
      previous.length === next.length &&
      previous.every(
        (heading, index) =>
          heading.element === next[index]?.element &&
          heading.text === next[index]?.text
      )
        ? previous
        : next,
    []
  )
  const [active, setActive] = useReducer((_: number, next: number) => next, 0)
  const [open, setOpen] = useReducer((_: boolean, next: boolean) => next, false)
  const [position, setPosition] = useReducer(
    (
      previous: { left: number; top: number },
      next: { left: number; top: number }
    ) =>
      previous.left === next.left && previous.top === next.top
        ? previous
        : next,
    { left: 0, top: 0 }
  )
  useEffect(() => {
    const element = host.current
    const pane = element?.parentElement
    if (!element || !pane) return
    const track = () => {
      const box = pane.getBoundingClientRect()
      setPosition({ left: box.left + 8, top: box.top + box.height / 2 })
      const found = Array.from(
        element.querySelectorAll<HTMLElement>(
          "[data-content-type='heading'], .writing-page [data-form='heading']"
        )
      )
        .filter((heading) => !!heading.textContent?.trim())
        .map((heading) => ({
          element: heading,
          text: heading.textContent?.trim() ?? "",
        }))
      setHeadings(found)
      const current = found.findLastIndex(
        (heading) =>
          heading.element.getBoundingClientRect().top <= box.top + 120
      )
      setActive(Math.max(0, current))
    }
    track()
    const mutations = new MutationObserver(track)
    mutations.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(track)
    observer?.observe(pane)
    pane.addEventListener("scroll", track, { passive: true })
    return () => {
      mutations.disconnect()
      observer?.disconnect()
      pane.removeEventListener("scroll", track)
    }
  }, [host])
  if (headings.length < 2) return null
  return (
    <nav
      aria-label="Outline"
      className="paper-document-outline"
      style={position}
    >
      <Popover
        open={open}
        onOpenChange={(next, details) =>
          setOpen(details.reason === "trigger-press" ? true : next)
        }
      >
        <PopoverTrigger
          openOnHover
          delay={0}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) setOpen(true)
          }}
          render={
            <Button
              variant="ghost"
              aria-label="Document outline"
              className="paper-outline-ticks size-11 md:size-8"
            >
              {headings.map((heading, index) => (
                <span
                  key={index}
                  className={
                    index === active
                      ? "bg-foreground"
                      : "bg-muted-foreground/35"
                  }
                  title={heading.text}
                />
              ))}
            </Button>
          }
        />
        <PopoverContent
          side="right"
          align="center"
          aria-label="Headings"
          className="w-max max-w-[min(13rem,calc(100vw-5rem))] min-w-40 motion-pop gap-0 p-1.5"
        >
          {headings.map((heading, index) => (
            <Button
              size="touch"
              variant="ghost"
              key={index}
              aria-current={index === active ? "location" : undefined}
              className="paper-outline-heading w-full justify-start whitespace-normal"
              onClick={() => {
                heading.element.scrollIntoView({
                  block: "start",
                  behavior: "instant",
                })
                setActive(index)
                setOpen(false)
              }}
            >
              {heading.text}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </nav>
  )
}
