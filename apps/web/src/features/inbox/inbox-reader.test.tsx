import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client.ts"
import { jsonOk, pathOf } from "@/test/mock-http.ts"
import {
  INBOX_NOW,
  LOCAL_DETAIL,
  REGIONAL_DETAIL,
} from "@/test/inbox-fixtures.ts"

import { initialReaderState, readerReducer } from "./inbox-reader.reducer.ts"
import { InboxReader } from "./inbox-reader.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function postsOf() {
  const posts: { path: string; input: unknown }[] = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : null
        posts.push({ path: pathOf(input), input: body?.input })
      }
      return jsonOk({ activityId: "00000000-0000-4000-8000-000000000099" })
    }
  )
  return posts
}

function renderReader(
  detail: typeof LOCAL_DETAIL,
  client = createQueryClient()
) {
  return render(
    <QueryClientProvider client={client}>
      <InboxReader
        detail={detail}
        index={1}
        count={6}
        narrow={false}
        now={INBOX_NOW}
        onBack={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe("inbox reader", () => {
  it("shows a newly received saved reply when the detail refreshes", () => {
    const posts = postsOf()
    const client = createQueryClient()
    const view = renderReader(REGIONAL_DETAIL, client)
    const refreshed = {
      ...REGIONAL_DETAIL,
      draft: { ...REGIONAL_DETAIL.draft!, body: "Updated from another view." },
    }

    view.rerender(
      <QueryClientProvider client={client}>
        <InboxReader
          detail={refreshed}
          index={1}
          count={6}
          narrow={false}
          now={INBOX_NOW}
          onBack={vi.fn()}
          onPrevious={vi.fn()}
          onNext={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue(
      "Updated from another view."
    )
    expect(posts).toEqual([])
  })

  it("keeps a dirty reply across refresh and saves it on blur", async () => {
    const posts = postsOf()
    const client = createQueryClient()
    const view = renderReader(REGIONAL_DETAIL, client)
    const reply = screen.getByRole("textbox", { name: "Reply" })
    await userEvent.clear(reply)
    await userEvent.type(reply, "My in-progress reply.")

    const refreshed = {
      ...REGIONAL_DETAIL,
      draft: { ...REGIONAL_DETAIL.draft!, body: "A newer saved reply." },
    }
    view.rerender(
      <QueryClientProvider client={client}>
        <InboxReader
          detail={refreshed}
          index={1}
          count={6}
          narrow={false}
          now={INBOX_NOW}
          onBack={vi.fn()}
          onPrevious={vi.fn()}
          onNext={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(reply).toHaveValue("My in-progress reply.")
    await userEvent.tab()
    expect(posts.map((post) => post.path)).toEqual([
      "/api/commands/inbox.updateDraft",
    ])
    expect(posts.map((post) => post.input)).toEqual([
      {
        threadId: REGIONAL_DETAIL.id,
        body: "My in-progress reply.",
      },
    ])
  })

  it("keeps a reply dirty when a newer refresh precedes its save acknowledgement", () => {
    const initial = initialReaderState("Original reply.")
    const typing = readerReducer(initial, {
      type: "reply_typed",
      value: "My reply.",
    })
    const refreshed = readerReducer(typing, {
      type: "draft_received",
      body: "Newer reply from another view.",
    })
    const acknowledged = readerReducer(refreshed, {
      type: "draft_saved",
      body: "My reply.",
      receivedBody: initial.receivedBody,
    })

    expect(acknowledged.body).toBe("My reply.")
    expect(acknowledged.savedBody).toBe("Newer reply from another view.")
  })

  it("offers the interview move and does not offer Send", async () => {
    const posts = postsOf()
    renderReader(LOCAL_DETAIL)
    expect(
      screen.getByText("Move this job from Applied to Interview?")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Move to Interview" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull()
    expect(posts).toEqual([])
    await userEvent.click(screen.getByRole("button", { name: "Not now" }))
    expect(posts.map((post) => post.path)).toEqual([
      "/api/commands/inbox.clearSuggestion",
    ])
  })

  it("moves the job only after Move to Interview", async () => {
    const posts = postsOf()
    renderReader(LOCAL_DETAIL)
    await userEvent.click(
      screen.getByRole("button", { name: "Move to Interview" })
    )
    expect(posts.map((post) => post.path)).toEqual([
      "/api/commands/inbox.acceptSuggestion",
    ])
  })

  it("does not send on first paint and shows the draft with its time chips", async () => {
    const posts = postsOf()
    renderReader(REGIONAL_DETAIL)
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue(
      REGIONAL_DETAIL.draft!.body
    )
    expect(screen.getAllByText("Hanh Tran")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Thu 14:30" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(
      screen.getByRole("button", { name: "Suggest another time" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add to calendar" })
    ).toBeInTheDocument()
    expect(posts).toEqual([])
    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(posts.map((post) => post.path)).toEqual(["/api/commands/inbox.send"])
  })

  it("disables Suggest another time when the Coach limit is reached", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathOf(input)
        if (
          path === "/api/commands/inbox.draftReply" &&
          (init?.method ?? "GET") === "POST"
        ) {
          return Response.json(
            {
              ok: false,
              error: {
                code: "COACH_LIMIT_REACHED",
                message:
                  "You've reached today's Free limit. Resets at 7:00. Pro has unlimited Coach chats.",
              },
            },
            { status: 429 }
          )
        }
        if (path === "/api/coach/usage") {
          return jsonOk({
            day: { resetsAt: "2026-10-28T00:00:00.000Z" },
          })
        }
        return jsonOk({})
      }
    )
    renderReader(REGIONAL_DETAIL)
    await userEvent.click(
      screen.getByRole("button", { name: "Suggest another time" })
    )
    expect(
      await screen.findByText("You've reached today's Free limit.")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "You've reached today's Free limit. Resets at 7:00. Pro has unlimited Coach chats."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Coach is back at 7:00 AM" })
    ).toBeDisabled()
  })
})
