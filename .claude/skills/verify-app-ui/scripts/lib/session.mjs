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

const postJson = (page, url, body) =>
  page.evaluate(`fetch(${JSON.stringify(url)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(${JSON.stringify(body)}),
  }).then((r) => r.status)`)

// Signs a throwaway account in on the page's browser session. The stack logs the sign-in code instead of mailing it.
export async function signUpThrowaway({ page, webUrl, apiUrl, logPath }) {
  await page.goto(`${webUrl}/sign-in`)
  await page.sleep(500)
  const email = `pen-layout-${Date.now()}@verify.local`
  const sent = await postJson(
    page,
    `${apiUrl}/api/auth/email-otp/send-verification-otp`,
    { email, type: "sign-in" }
  )
  if (sent !== 200) throw new Error(`send-verification-otp returned ${sent}`)
  let otp = null
  for (let attempt = 0; attempt < 20 && !otp; attempt += 1) {
    otp = readSignInCode(logPath, email)
    if (!otp) await page.sleep(100)
  }
  if (!otp) throw new Error("sign-in code was not logged")
  const status = await postJson(page, `${apiUrl}/api/auth/sign-in/email-otp`, {
    email,
    otp,
    name: "Pen Layout",
  })
  if (status !== 200) throw new Error(`sign-in returned ${status}`)
  return email
}
