import { readFileSync } from "node:fs"

export const UNBROKEN = "W".repeat(200)
export const EMAIL = `${"a".repeat(28)}@example.com`
export const EVENING = "2026-11-03T12:00:00.000Z"
export const DEADLINE = "2026-11-03"
export const MARK = UNBROKEN.slice(0, 40)

const SIGN_IN_CODE = /\[auth\] email code for (.+) type ([a-z-]+): ([0-9]{6})/

function readSignInCode(logPath, email) {
  let text = ""
  try {
    text = readFileSync(logPath, "utf8")
  } catch {
    return null
  }
  for (const line of text.split("\n").reverse()) {
    const match = line.match(SIGN_IN_CODE)
    if (match && match[1] === email && match[2] === "sign-in") return match[3]
  }
  return null
}

const postJson = (page, url, body) =>
  page.evaluate(`fetch(${JSON.stringify(url)}, {
    method: "POST", credentials: "include", headers: { "content-type": "application/json" },
    body: JSON.stringify(${JSON.stringify(body)}),
  }).then((r) => r.status)`)

export async function signInWorstCase({ page, webUrl, apiUrl, logPath }) {
  if (webUrl) {
    await page.goto(`${webUrl}/sign-in`)
    await page.sleep(400)
  }
  const sent = await postJson(
    page,
    `${apiUrl}/api/auth/email-otp/send-verification-otp`,
    { email: EMAIL, type: "sign-in" }
  )
  if (sent !== 200) throw new Error(`send-verification-otp returned ${sent}`)
  let otp = null
  for (let attempt = 0; attempt < 50 && !otp; attempt += 1) {
    otp = readSignInCode(logPath, EMAIL)
    if (!otp) await page.sleep(100)
  }
  if (!otp) throw new Error("sign-in code was not logged")
  const deadline = Date.now() + 70000
  let status = 429
  while (status === 429 && Date.now() < deadline) {
    status = await postJson(page, `${apiUrl}/api/auth/sign-in/email-otp`, {
      email: EMAIL,
      otp,
      name: "Worst Case",
    })
    if (status === 429) await page.sleep(2000)
  }
  if (status !== 200) throw new Error(`sign-in returned ${status}`)
  return EMAIL
}

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
    { id: "jobs", path: "/jobs", mark: false },
    { id: "inbox", path: "/inbox", mark: false },
    { id: "proofs", path: "/proofs", mark: false },
    { id: "paper", path: "/paper", mark: true },
    { id: "apply", path: "/apply", mark: true },
    { id: "apply-detail", path: `/apply/${jobId}`, mark: true },
    {
      id: "apply-filters",
      path: `/apply?company=${value}&location=${value}`,
      mark: true,
    },
    {
      id: "apply-calendar",
      path: "/apply?view=calendar&span=week",
      mark: true,
    },
    { id: "pitch", path: "/pitch", mark: false },
    { id: "settings", path: "/settings", mark: false },
    { id: "coach", path: "/coach", mark: true, openJob: true },
  ]
}
