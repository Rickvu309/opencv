import type { InboxDetail, InboxThread } from "@workspace/domain"

export const INBOX_NOW = new Date("2026-10-27T03:00:00.000Z")

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
] as const

export const INBOX_THREADS: InboxThread[] = [
  thread(
    ids[0],
    "Regional bank",
    "Business Analyst",
    "Re: Business Analyst application",
    "2026-10-26T02:41:00.000Z",
    true
  ),
  thread(
    ids[1],
    "Local startup",
    "Associate PM",
    "Interview invite, Thu 10:00",
    "2026-10-26T01:02:00.000Z",
    true,
    "interview",
    "00000000-0000-4000-8000-0000000000aa"
  ),
  thread(
    ids[2],
    "Lumière",
    "Marketing Executive",
    "Closes in 2 days",
    "2026-10-26T00:00:00.000Z",
    true
  ),
  thread(
    ids[3],
    "Fintech app",
    "Growth Marketer",
    "No reply in 11 days",
    "2026-10-25T04:00:00.000Z",
    true
  ),
  thread(
    ids[4],
    "Agency",
    "Content Specialist",
    "Not moving forward",
    "2026-10-24T04:00:00.000Z",
    false
  ),
  thread(
    ids[5],
    "E-commerce co.",
    "Product Analyst",
    "Application received",
    "2026-10-21T02:00:00.000Z",
    false
  ),
]

export const REGIONAL_DETAIL: InboxDetail = {
  ...INBOX_THREADS[0]!,
  subject: "Re: Business Analyst application",
  messages: [
    {
      id: "regional-bank-in",
      direction: "in",
      fromName: "Hanh Tran",
      fromEmail: "hanh.tran@regionalbank.example",
      toEmail: "linh.nguyen@example.com",
      bodyText: "Can you do a 20 minute call on Thursday afternoon?",
      sentAt: "2026-10-26T02:41:00.000Z",
    },
  ],
  draft: {
    body: "Hi Hanh, Thank you. Thursday at 14:30 works for me.",
    times: ["2026-10-29T07:30:00.000Z", "2026-10-29T08:00:00.000Z"],
  },
  job: null,
  openUrl: null,
}

export const LOCAL_DETAIL: InboxDetail = {
  ...INBOX_THREADS[1]!,
  subject: "Interview invite",
  messages: [
    {
      id: "local-startup-in",
      direction: "in",
      fromName: "Local startup",
      fromEmail: "hiring@localstartup.example",
      toEmail: "linh.nguyen@example.com",
      bodyText: "Can we do a call Thursday at 10:00?",
      sentAt: "2026-10-26T01:02:00.000Z",
    },
  ],
  draft: null,
  job: {
    id: "00000000-0000-4000-8000-0000000000aa",
    title: "Associate PM",
    stage: "applied",
  },
  openUrl: null,
}

function thread(
  id: string,
  company: string,
  role: string,
  summary: string,
  lastMessageAt: string,
  unread: boolean,
  suggestedStage: "interview" | null = null,
  jobId: string | null = null
): InboxThread {
  return {
    id,
    company,
    role,
    summary,
    lastMessageAt,
    unread,
    suggestedStage,
    jobId,
    status: "open",
  }
}
