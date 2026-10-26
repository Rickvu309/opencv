import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { INBOX_NOW, INBOX_THREADS } from "@/test/inbox-fixtures.ts"

import { InboxList } from "./inbox-list.tsx"
import { inboxChip, inboxWhen } from "./inbox-time.ts"

afterEach(() => {
  cleanup()
})

describe("inbox list", () => {
  it("shows six rows, the interview summary, and 4 unread", () => {
    render(
      <InboxList
        threads={INBOX_THREADS}
        openId={null}
        now={INBOX_NOW}
        scanning={false}
        onOpen={vi.fn()}
        onScan={vi.fn()}
      />
    )
    const rows = screen.getAllByRole("button", { name: /, / })
    expect(rows).toHaveLength(6)
    expect(
      screen.getByRole("button", {
        name: /Associate PM, Local startup, Interview invite, Thu 10:00/,
      })
    ).toBeInTheDocument()
    expect(screen.getByText("4 unread")).toBeInTheDocument()
  })

  it("formats list times and chips in the profile zone", () => {
    expect(inboxWhen("2026-10-26T02:41:00.000Z", INBOX_NOW)).toBe("Mon")
    expect(inboxWhen("2026-10-27T02:41:00.000Z", INBOX_NOW)).toBe("9:41")
    expect(inboxWhen("2026-10-21T02:00:00.000Z", INBOX_NOW)).toBe("Oct 21")
    expect(inboxChip("2026-10-29T07:30:00.000Z")).toBe("Thu 14:30")
    expect(inboxChip("2026-10-29T08:00:00.000Z")).toBe("Thu 15:00")
  })
})
