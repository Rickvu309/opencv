import { chromium } from "playwright-core"

export async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true })
  } catch {
    return await chromium.launch({ headless: true, channel: "chrome" })
  }
}
