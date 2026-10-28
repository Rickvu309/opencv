export type ApplyCard = {
  id: string
  title: string
  company: string
  note: string
  stage: "inbox" | "prep" | "sent" | "live" | "closed"
  position: string
  starred: boolean
  jobUrl: string | null
  demo: boolean
  trackDate: string
  trackKind: "interview" | "deadline" | "followup" | "applied"
  createdAt: string
  updatedAt: string
}

function iso(daysAgo: number) {
  return new Date(Date.UTC(2026, 7, 25 - daysAgo, 12, 0, 0)).toISOString()
}

/**
 * Neutral sample cards for the Apply API mock — never the demo persona.
 * Associate PM intern keeps a leftover jobs.example.com URL so UI tests
 * prove Open job posting is hidden (QVE-217). New production seeds are null.
 * Starter-shaped cards are `demo: true` so the board/drawer stay honest (QVE-240).
 * Product intern is a User-owned extra so we can prove Add-job cards stay unlabeled.
 */
export function sampleApplyCards(): ApplyCard[] {
  return [
    {
      id: "01900000-0000-7000-8000-000000000001",
      title: "Associate PM intern",
      company: "Local startup",
      note: "JD wants discovery notes + 1 shipped experiment.",
      stage: "inbox",
      position: "a0",
      starred: true,
      jobUrl: "https://jobs.example.com/associate-pm-intern",
      demo: true,
      trackDate: "2026-08-26",
      trackKind: "followup",
      createdAt: iso(0),
      updatedAt: iso(0),
    },
    {
      id: "01900000-0000-7000-8000-000000000002",
      title: "Product intern",
      company: "Fintech scale-up",
      note: "Interview Thu, prep onboarding Proof.",
      stage: "inbox",
      position: "a1",
      starred: false,
      jobUrl: null,
      demo: false,
      trackDate: "2026-08-26",
      trackKind: "interview",
      createdAt: iso(0),
      updatedAt: iso(0),
    },
    {
      id: "01900000-0000-7000-8000-000000000003",
      title: "Business analyst intern",
      company: "Regional bank",
      note: "Emphasize SQL + flow mapping.",
      stage: "prep",
      position: "a0",
      starred: false,
      jobUrl: null,
      demo: true,
      trackDate: "2026-08-15",
      trackKind: "followup",
      createdAt: iso(1),
      updatedAt: iso(1),
    },
    {
      id: "01900000-0000-7000-8000-000000000004",
      title: "Product analyst intern",
      company: "E-commerce co.",
      note: "Checkout Proof is a strong hook.",
      stage: "sent",
      position: "a0",
      starred: false,
      jobUrl: null,
      demo: true,
      trackDate: "2026-08-20",
      trackKind: "applied",
      createdAt: iso(4),
      updatedAt: iso(4),
    },
    {
      id: "01900000-0000-7000-8000-000000000005",
      title: "UX research intern",
      company: "Agency",
      note: "Passed, need more research samples.",
      stage: "closed",
      position: "a0",
      starred: false,
      jobUrl: null,
      demo: true,
      trackDate: "2026-08-10",
      trackKind: "applied",
      createdAt: iso(7),
      updatedAt: iso(7),
    },
  ]
}
