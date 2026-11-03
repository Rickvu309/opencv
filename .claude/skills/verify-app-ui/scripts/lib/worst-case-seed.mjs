import { signInThrowaway } from "./session.mjs"

export const UNBROKEN = "W".repeat(200)
export const EMAIL = `${"a".repeat(28)}@example.com`
export const EVENING = "2026-11-03T12:00:00.000Z"
export const DEADLINE = "2026-11-03"
export const MARK = UNBROKEN.slice(0, 40)

export function signInWorstCase({ page, webUrl, apiUrl, logPath }) {
  return signInThrowaway({
    page,
    webUrl,
    apiUrl,
    logPath,
    email: EMAIL,
    name: "Worst Case",
  })
}

export function seedIsWorstCase({ unbroken, email }) {
  return (
    unbroken.length === 200 &&
    !unbroken.includes(" ") &&
    email.length === 40 &&
    email.includes("@")
  )
}

export const badFixture = [
  {
    name: "a short email is not the worst case",
    fails: () =>
      seedIsWorstCase({ unbroken: UNBROKEN, email: "a@b.co" }) === false,
  },
]

async function command(page, apiUrl, name, input) {
  const result =
    await page.evaluate(`fetch(${JSON.stringify(`${apiUrl}/api/commands/${name}`)}, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: ${JSON.stringify(input)}, idempotencyKey: crypto.randomUUID() }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.text() }))`)
  if (!result.ok)
    throw new Error(
      `${name} ${result.status} ${String(result.body).slice(0, 180)}`
    )
  const parsed = JSON.parse(result.body)
  return parsed.data ?? parsed
}

export async function seedWorstCase({ page, apiUrl }) {
  const job = await command(page, apiUrl, "job.create", {
    title: UNBROKEN,
    company: UNBROKEN,
    location: UNBROKEN,
    stage: "interview",
    deadline: DEADLINE,
  })
  const jobId = job.id ?? job.jobId
  if (!jobId) throw new Error("job.create returned no id")
  await command(page, apiUrl, "job.update", {
    jobId,
    patch: { interviewAt: EVENING },
  })
  await command(page, apiUrl, "job.addChecklistItem", {
    jobId,
    label: UNBROKEN,
  })
  await command(page, apiUrl, "job.addNote", { jobId, body: UNBROKEN })
  const paper = await command(page, apiUrl, "paper.create", {
    kind: "cv",
    name: UNBROKEN,
  })
  if (!(paper.docId ?? paper.id)) throw new Error("paper.create returned no id")
  const chat = await command(page, apiUrl, "chat.open", {})
  const chatId = chat.id ?? chat.chatId
  if (!chatId) throw new Error("chat.open returned no id")
  await command(page, apiUrl, "chat.appendMessage", {
    chatId,
    text: UNBROKEN,
    attachments: [{ kind: "job", id: jobId, label: UNBROKEN }],
  })
  return { jobId }
}

export function routesFor(jobId) {
  const value = encodeURIComponent(UNBROKEN)
  return [
    { id: "jobs", path: "/jobs" },
    { id: "inbox", path: "/inbox" },
    { id: "proofs", path: "/proofs" },
    { id: "paper", path: "/paper", needle: MARK },
    { id: "apply", path: "/apply", needle: MARK },
    { id: "apply-detail", path: `/apply/${jobId}`, needle: MARK },
    {
      id: "apply-filters",
      path: `/apply?company=${value}&location=${value}`,
      needle: MARK,
    },
    {
      id: "apply-calendar",
      path: "/apply?view=calendar&span=week",
      needle: MARK,
    },
    {
      id: "apply-calendar-month",
      path: "/apply?view=calendar&span=month",
      needle: MARK,
    },
    { id: "pitch", path: "/pitch" },
    { id: "settings", path: "/settings" },
    { id: "coach", path: "/coach", needle: MARK, openJob: true },
    {
      id: "session-expired",
      path: "/settings",
      needle: EMAIL,
      openExpired: true,
    },
  ]
}
