import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { INBOX_NOW, INBOX_THREADS } from "@/test/inbox-fixtures.ts"

import { InboxList, InboxOverview } from "./inbox-list.tsx"
import { CompanyChip } from "./inbox-parts.tsx"
import {
  inboxChip,
  inboxStamp,
  inboxWhen,
  nextMorningIso,
} from "./inbox-time.ts"

afterEach(() => {
  cleanup()
})

describe("inbox list", () => {
  it("shows six rows and the interview summary", () => {
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
    expect(screen.getByText("Interview invite, Thu 10:00")).toBeInTheDocument()
    expect(
      screen.getByText("Re: Business Analyst application")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /Associate PM, Local startup, Interview invite, Thu 10:00/,
      })
    ).toHaveAttribute("data-slot", "inbox-row")
  })

  it("counts unread threads in the overview", () => {
    render(<InboxOverview threads={INBOX_THREADS} />)
    expect(screen.getByText("4 unread")).toBeInTheDocument()
  })

  it("formats list times in a non-default zone", () => {
    const sameDay = {
      ...INBOX_THREADS[0]!,
      lastMessageAt: "2026-10-27T02:41:00.000Z",
    }
    render(
      <InboxList
        threads={[sameDay]}
        openId={null}
        now={INBOX_NOW}
        zone="Asia/Singapore"
        scanning={false}
        onOpen={vi.fn()}
        onScan={vi.fn()}
      />
    )
    expect(screen.getByText("10:41")).toBeInTheDocument()
    expect(inboxWhen("2026-10-27T02:41:00.000Z", INBOX_NOW)).toBe("9:41")
    expect(inboxChip("2026-10-29T07:30:00.000Z", "Asia/Singapore")).toBe(
      "Thu 15:30"
    )
    expect(nextMorningIso(INBOX_NOW, "Asia/Singapore")).toBe(
      "2026-10-27T23:00:00.000Z"
    )
    render(
      <ul>
        <CompanyChip name="Regional bank" />
      </ul>
    )
    expect(document.querySelector("[data-slot='company-tile']")).not.toBeNull()
  })

  it("formats list times and chips in the profile zone", () => {
    expect(inboxWhen("2026-10-26T02:41:00.000Z", INBOX_NOW)).toBe("Mon")
    expect(inboxWhen("2026-10-27T02:41:00.000Z", INBOX_NOW)).toBe("9:41")
    expect(inboxWhen("2026-10-21T02:00:00.000Z", INBOX_NOW)).toBe("Oct 21")
    expect(inboxChip("2026-10-29T07:30:00.000Z")).toBe("Thu 14:30")
    expect(inboxChip("2026-10-29T08:00:00.000Z")).toBe("Thu 15:00")
  })

  it("names the last few days by weekday across the week boundary", () => {
    const monday = new Date("2026-10-26T04:41:00.000Z")
    expect(inboxWhen("2026-10-26T02:41:00.000Z", monday)).toBe("9:41")
    expect(inboxWhen("2026-10-25T04:00:00.000Z", monday)).toBe("Sun")
    expect(inboxWhen("2026-10-24T04:00:00.000Z", monday)).toBe("Sat")
    expect(inboxWhen("2026-10-21T02:00:00.000Z", monday)).toBe("Oct 21")
  })

  it("writes the full date with how long ago it was", () => {
    const monday = new Date("2026-10-26T04:41:00.000Z")
    expect(inboxStamp("2026-10-26T02:41:00.000Z", monday)).toBe(
      "Mon, Oct 26, 9:41 (2 hours ago)"
    )
    expect(inboxStamp("2026-10-26T04:11:00.000Z", monday)).toBe(
      "Mon, Oct 26, 11:11 (30 minutes ago)"
    )
    expect(inboxStamp("2026-10-23T02:41:00.000Z", monday)).toBe(
      "Fri, Oct 23, 9:41 (3 days ago)"
    )
  })
})
