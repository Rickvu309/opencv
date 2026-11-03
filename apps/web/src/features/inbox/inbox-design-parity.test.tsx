import { QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { InboxDetail, InboxThread } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client.ts"
import { jsonOk, pathOf } from "@/test/mock-http.ts"

import connectFile from "./design/w2-1-connect.snapshot.json"
import scanningFile from "./design/w2-2-scanning.snapshot.json"
import inboxFile from "./design/w2-3-inbox.snapshot.json"
import replyFile from "./design/w2-4-reply.snapshot.json"
import { InboxPage } from "./inbox-page.tsx"

const STAGE_TEXT_UNTIL_437_RENAME: Readonly<Record<string, string>> = {
  "Move this job from Sent to Live?":
    "Move this job from Applied to Interview?",
  "Move to Live": "Move to Interview",
  "Invites move jobs to Live. Rejections close them.":
    "Invites move jobs to Interview. Rejections close them.",
  Sent: "Applied",
  Live: "Interview",
}

const AVATAR_INITIALS_FROM_COMPANY_NAME: Readonly<Record<string, string>> = {
  LC: "LU",
}

const PEN_TEXT_SHOWN_INSTEAD: Readonly<Record<string, string>> = {
  ...STAGE_TEXT_UNTIL_437_RENAME,
  ...AVATAR_INITIALS_FROM_COMPANY_NAME,
}

type PenSnapshot = {
  source: { frameId: string; root?: string }
  sections: { id: string; name: string; texts: string[] }[]
}

const connect = connectFile as PenSnapshot
const scanning = scanningFile as PenSnapshot
const inbox = inboxFile as PenSnapshot
const reply = replyFile as PenSnapshot

const MONDAY_1141_PROFILE_ZONE = new Date("2026-10-26T04:41:00.000Z")
const ZONE = "Asia/Ho_Chi_Minh"
const OWNER_EMAIL = "linh.nguyen@gmail.com"
const RECRUITER_EMAIL = "hanh.tran@regionalbank.vn"

const THREADS: InboxThread[] = [
  thread(
    1,
    "Regional bank",
    "Business Analyst",
    "Can we do a call Thursday?",
    "2026-10-26T02:41:00.000Z",
    true
  ),
  thread(
    2,
    "Local startup",
    "Associate PM",
    "Interview invite, Thu 10:00",
    "2026-10-26T01:02:00.000Z",
    true
  ),
  thread(
    3,
    "Lumière",
    "Marketing Executive",
    "Closes in 2 days",
    "2026-10-26T00:00:00.000Z",
    true
  ),
  thread(
    4,
    "Fintech app",
    "Growth Marketer",
    "No reply in 11 days",
    "2026-10-25T04:00:00.000Z",
    true
  ),
  thread(
    5,
    "Agency",
    "Content Specialist",
    "Not moving forward",
    "2026-10-24T04:00:00.000Z",
    false
  ),
  thread(
    6,
    "E-commerce co.",
    "Product Analyst",
    "Application received",
    "2026-10-21T02:00:00.000Z",
    false
  ),
]

const REPLY_DETAIL: InboxDetail = {
  ...THREADS[0]!,
  subject: "Re: Business Analyst application",
  messages: [
    {
      id: "earlier",
      direction: "out",
      fromName: "Linh Nguyen",
      fromEmail: OWNER_EMAIL,
      toEmail: RECRUITER_EMAIL,
      bodyText: "Hi Hanh, my CV for the Business Analyst role is attached.",
      sentAt: "2026-10-15T03:00:00.000Z",
    },
    {
      id: "latest",
      direction: "in",
      fromName: "Hanh Tran",
      fromEmail: RECRUITER_EMAIL,
      toEmail: OWNER_EMAIL,
      bodyText:
        "Hi Linh,\n\nThanks for applying for the Business Analyst role. Your background fits what we need, especially your SQL and reporting work.\n\nCan you do a 20 minute call on Thursday afternoon? Any time after 14:00 works for us.\n\nBest,\nHanh",
      sentAt: "2026-10-26T02:41:00.000Z",
    },
  ],
  draft: {
    body: "Hi Hanh,\n\nThank you. Thursday at 14:30 works for me. Should I prepare anything before the call?\n\nBest,\nLinh",
    times: ["2026-10-29T07:30:00.000Z", "2026-10-29T08:00:00.000Z"],
  },
  job: {
    id: "00000000-0000-4000-8000-0000000000aa",
    title: "Business Analyst",
    stage: "applied",
  },
  openUrl: null,
}

function thread(
  number: number,
  company: string,
  role: string,
  summary: string,
  lastMessageAt: string,
  unread: boolean
): InboxThread {
  return {
    id: `00000000-0000-4000-8000-00000000000${number}`,
    company,
    role,
    summary,
    lastMessageAt,
    unread,
    suggestedStage: number === 1 ? "interview" : null,
    jobId: number === 1 ? "00000000-0000-4000-8000-0000000000aa" : null,
    status: "open",
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(MONDAY_1141_PROFILE_ZONE)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function shown(text: string): string {
  return PEN_TEXT_SHOWN_INSTEAD[text] ?? text
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "META"])

function normalize(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim()
}

function isWordChar(char: string): boolean {
  return char !== "" && /[\p{L}\p{N}]/u.test(char)
}

function bounded(haystack: string, needle: string, at: number): boolean {
  const before = at > 0 ? haystack[at - 1] : ""
  const after =
    at + needle.length < haystack.length ? haystack[at + needle.length] : ""
  const leftOk = !isWordChar(needle[0] ?? "") || !isWordChar(before)
  const rightOk =
    !isWordChar(needle[needle.length - 1] ?? "") || !isWordChar(after)
  return leftOk && rightOk
}

function hidden(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true
  if (element.getAttribute("aria-hidden") === "true") return true
  if (element.hasAttribute("hidden")) return true
  if (element.classList.contains("sr-only")) return true
  if (element.classList.contains("hidden")) return true
  if (element.classList.contains("invisible")) return true
  return false
}

function visibleText(root: Element): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "")
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    if (hidden(element)) return
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      if (element.placeholder) parts.push(element.placeholder)
    }
    if (element instanceof HTMLTextAreaElement && element.value) {
      parts.push(element.value)
    }
    for (const child of element.childNodes) walk(child)
  }
  walk(root)
  return normalize(parts.join(" "))
}

function nextHit(
  haystack: string,
  needle: string,
  from: number,
  longer: readonly string[]
): number {
  let cursor = from
  while (cursor < haystack.length) {
    const at = haystack.indexOf(needle, cursor)
    if (at < 0) return -1
    cursor = at + 1
    if (!bounded(haystack, needle, at)) continue
    const end = at + needle.length
    const inside = longer.some((item) => {
      let coverFrom = 0
      while (coverFrom < haystack.length) {
        const coverAt = haystack.indexOf(item, coverFrom)
        if (coverAt < 0) return false
        coverFrom = coverAt + 1
        if (!bounded(haystack, item, coverAt)) continue
        if (coverAt <= at && end <= coverAt + item.length) return true
      }
      return false
    })
    if (!inside) return end
  }
  return -1
}

function missingInOrder(
  haystack: string,
  texts: readonly string[]
): string | null {
  const shownTexts = texts.map((text) => normalize(shown(text)))
  let cursor = 0
  for (let index = 0; index < shownTexts.length; index += 1) {
    const needle = shownTexts[index] ?? ""
    const longer = shownTexts.filter(
      (item, itemIndex) =>
        itemIndex !== index &&
        item.length > needle.length &&
        item.includes(needle)
    )
    const end = nextHit(haystack, needle, cursor, longer)
    if (end < 0) return texts[index] ?? needle
    cursor = end
  }
  return null
}

function stripNeedles(haystack: string, needles: readonly string[]): string {
  const ordered = [...needles]
    .map((needle) => normalize(needle))
    .filter((needle) => needle !== "")
    .sort((left, right) => right.length - left.length)
  let current = haystack
  for (const needle of ordered) {
    let built = ""
    let from = 0
    while (from < current.length) {
      const at = current.indexOf(needle, from)
      if (at < 0) {
        built += current.slice(from)
        break
      }
      if (!bounded(current, needle, at)) {
        built += current.slice(from, at + 1)
        from = at + 1
        continue
      }
      built += `${current.slice(from, at)} `
      from = at + needle.length
    }
    current = built
  }
  return normalize(current)
}

function sectionReading(frame: Element, name: string): string {
  const section = frame.querySelector(`[data-pen-section="${name}"]`)
  return section ? visibleText(section) : ""
}

function inKitHeaderOrder(texts: readonly string[]): string[] {
  const counter = texts.find((text) => /^\d+ of \d+$/.test(text))
  if (!counter) return [...texts]
  return [counter, ...texts.filter((text) => text !== counter)]
}

function compare(frame: Element, snapshot: PenSnapshot): string {
  const problems: string[] = []
  for (const section of snapshot.sections) {
    const missing = missingInOrder(
      sectionReading(frame, section.name),
      inKitHeaderOrder(section.texts)
    )
    if (missing) {
      problems.push(`${section.name}: missing ${JSON.stringify(missing)}`)
    }
  }
  const needles = snapshot.sections.flatMap((section) =>
    section.texts.map(shown)
  )
  const extra = stripNeedles(visibleText(frame), needles)
  if (extra) problems.push(`extra text ${JSON.stringify(extra)}`)
  return problems.join("\n")
}

type Scenario = {
  list: { connected: boolean; skipped: boolean; threads: InboxThread[] }
  scan?: unknown
}

function renderInbox({ list, scan }: Scenario) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const method = init?.method ?? "GET"
      if (path === "/api/inbox/connect") {
        return jsonOk({ url: "https://accounts.example.com/gmail" })
      }
      if (path === "/api/inbox") return jsonOk({ ...list, timeZone: ZONE })
      if (path.startsWith("/api/inbox/")) return jsonOk(REPLY_DETAIL)
      if (method === "POST" && path === "/api/commands/inbox.scan") {
        return jsonOk(scan)
      }
      return jsonOk({})
    }
  )
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <InboxPage />
    </QueryClientProvider>
  )
}

describe("inbox design parity", () => {
  it("matches W2.1 Connect Gmail", async () => {
    const { container } = renderInbox({
      list: { connected: false, skipped: false, threads: [] },
    })
    await screen.findByRole("heading", {
      level: 2,
      name: "Never miss a recruiter reply",
    })
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Gmail" })
      ).toBeEnabled()
    })
    expect(compare(container, connect)).toBe("")
  })

  it("matches W2.2 Scanning", async () => {
    const names = [
      "Regional bank",
      "Local startup",
      "Lumière",
      "E-commerce co.",
      "Agency",
    ]
    const { container } = renderInbox({
      list: { connected: true, skipped: false, threads: [] },
      scan: {
        threads: names.map((name) =>
          THREADS.find((row) => row.company === name)!
        ),
        emailCount: 12,
        companyCount: 5,
      },
    })
    await userEvent.click(await screen.findByRole("button", { name: "Scan" }))
    await screen.findByText("12 emails from 5 companies so far")
    expect(compare(container, scanning)).toBe("")
  })

  it("matches W2.3 Inbox with nothing selected", async () => {
    const { container } = renderInbox({
      list: { connected: true, skipped: false, threads: THREADS },
    })
    await screen.findByText("4 unread")
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull()
    expect(compare(container, inbox)).toBe("")
  })

  it("matches W2.4 Recruiter reply", async () => {
    const { container } = renderInbox({
      list: { connected: true, skipped: false, threads: THREADS },
    })
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Business Analyst, Regional bank/,
      })
    )
    const pane = await screen.findByRole("region", { name: "Reading pane" })
    await within(pane).findByRole("button", { name: "Send" })
    expect(compare(container, reply)).toBe("")
  })
})
