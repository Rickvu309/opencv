import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, useState, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { STREAMING_COACH_ID } from "@/features/home/threads.ts"
import {
  installThreadApiMock,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"

import { useCoachTurn } from "./use-coach-turn.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const webSrc = path.join(here, "../..")

function read(rel: string) {
  return readFileSync(path.join(webSrc, rel), "utf8")
}

describe("shared Coach turn hook", () => {
  it("is the only turn implementation; Paper no longer has a private coach hook", () => {
    expect(
      existsSync(path.join(webSrc, "features/paper/use-paper-coach.ts"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/paper-ai-chat.tsx"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/coach-thread-panel.tsx"))
    ).toBe(false)

    const hook = read("features/coach/use-coach-turn.ts")
    expect(hook).toMatch(/export function useCoachTurn/)
    expect(hook).toMatch(/getThreadByFocusDoc/)
    expect(hook).toMatch(/focusDocId/)
    expect(hook).not.toMatch(/sessionStorage/)
    expect(hook).not.toMatch(/paperCoachThreadStorageKey/)

    const store = read("features/home/thread-store.tsx")
    expect(store).toMatch(/useCoachTurn/)
    expect(store).not.toMatch(/streamCoachTurn/)

    const panel =
      read("features/paper/coach-float.tsx") +
      read("features/paper/coach-float-chips.tsx")
    expect(panel).toMatch(/useCoachTurn/)
    expect(read("features/coach/coach-thread.tsx")).not.toMatch(
      /assistant-ui|AssistantRuntime/
    )
    expect(panel).toMatch(/CoachThread/)
    expect(panel).toMatch(/data-coach-soft-scope/)
    expect(panel).toMatch(/data-coach-context-chip/)
    expect(panel).toMatch(/Add to context/)
    expect(panel).toMatch(/Pin in context/)
    expect(panel).toMatch(/Attached from Paper/)
    expect(panel).toMatch(/Remove from context/)
    expect(panel).toMatch(/PaperCiteControl/)
    expect(panel).toMatch(/rememberCoachCites/)
    expect(panel).not.toMatch(/provenance/)
    expect(panel).not.toMatch(/sources rail/)
    const cite = read("features/paper/paper-cite-control.tsx")
    expect(cite).toMatch(/data-coach-cite/)
    expect(cite).toMatch(/Show on Paper/)
    expect(cite).not.toMatch(/provenance/)
    expect(cite).not.toMatch(/sources rail/)
    expect(cite).not.toMatch(/knowledge-base/)
    expect(panel).not.toMatch(/ThreadView/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(/CoachDock/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(
      /showModePicker=\{false\}/
    )
    expect(read("features/coach/coach-thread.tsx")).toMatch(/onAttachFromPaper/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(/messageCite/)
    expect(read("features/coach/coach-thread.tsx")).not.toMatch(/provenance/)
    expect(read("features/coach/coach-thread.tsx")).not.toMatch(/sources rail/)
    expect(read("features/coach/coach-dock.tsx")).toMatch(/onAttachFromPaper/)
    expect(panel).not.toMatch(/sessionStorage/)
    expect(panel).not.toMatch(/Sparkles/)
    expect(panel).not.toMatch(/AI assist/)
    expect(panel).not.toMatch(/knowledge-base/)
    expect(panel).not.toMatch(/Add sources/)
    expect(panel).not.toMatch(/sources library/)
  })
})

describe("useCoachTurn turn lifecycle", () => {
  beforeEach(() => installThreadApiMock())
  afterEach(() => vi.unstubAllGlobals())

  it("regenerates after an aborted send without duplicating the new reply", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(
      () => {
        const [threadId, setThreadId] = useState<string | null>(null)
        return useCoachTurn({
          threadId,
          setThreadId,
          titleForCreate: (text) => text,
        })
      },
      { wrapper }
    )
    const coachTexts = () =>
      result.current.messages
        .filter((message) => message.role === "coach")
        .map((message) => message.text)

    const stream = scriptCoachStream({
      gated: true,
      texts: ["Partial reply", " never shown"],
    })
    act(() => {
      result.current.send("Stop me")
    })
    expect(result.current.phase).toBe("waiting")
    stream.release(2)
    await waitFor(() => expect(result.current.phase).toBe("streaming"))

    act(() => result.current.stop())
    await waitFor(() => expect(result.current.phase).toBe("idle"))
    expect(coachTexts()).toEqual(["Partial reply"])
    expect(result.current.error).toBeNull()

    scriptCoachStream({ texts: ["Fresh reply"] })
    act(() => {
      result.current.regenerate()
    })
    await waitFor(() => expect(coachTexts()).toContain("Fresh reply"))
    await waitFor(() => expect(result.current.phase).toBe("idle"))
    expect(coachTexts()).toEqual(["Partial reply", "Fresh reply"])
    const ids = result.current.messages.map((message) => message.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain(STREAMING_COACH_ID)
  })
})
