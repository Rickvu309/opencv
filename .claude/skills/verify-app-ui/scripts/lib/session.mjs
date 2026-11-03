import { readFileSync } from "node:fs"

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

const VERIFY_LIMIT_WINDOW_MS = 70000

const postJson = (page, url, body) =>
  page.evaluate(`fetch(${JSON.stringify(url)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(${JSON.stringify(body)}),
  }).then((r) => r.status)`)

export async function signInThrowaway({
  page,
  webUrl,
  apiUrl,
  logPath,
  name = "Verify",
  prefix = "verify",
  email,
}) {
  if (webUrl) {
    await page.goto(`${webUrl}/sign-in`)
    await page.sleep(500)
  }
  const address =
    email ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@verify.local`
  const sent = await postJson(
    page,
    `${apiUrl}/api/auth/email-otp/send-verification-otp`,
    { email: address, type: "sign-in" }
  )
  if (sent !== 200) throw new Error(`send-verification-otp returned ${sent}`)
  let otp = null
  for (let attempt = 0; attempt < 50 && !otp; attempt += 1) {
    otp = readSignInCode(logPath, address)
    if (!otp) await page.sleep(100)
  }
  if (!otp) throw new Error("sign-in code was not logged")
  const deadline = Date.now() + VERIFY_LIMIT_WINDOW_MS
  let status = 429
  while (status === 429 && Date.now() < deadline) {
    status = await postJson(page, `${apiUrl}/api/auth/sign-in/email-otp`, {
      email: address,
      otp,
      name,
    })
    if (status === 429) await page.sleep(2000)
  }
  if (status !== 200) throw new Error(`sign-in returned ${status}`)
  return address
}
