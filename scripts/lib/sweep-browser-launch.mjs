const DIRECT_LAUNCH = /\bchromium\.launch\(/
const LAUNCHER = "launch-browser.mjs"

export function detect(text, file = "scripts/ui/sweep/probe.test.mjs") {
  if (file.endsWith(`/${LAUNCHER}`)) return []
  if (!DIRECT_LAUNCH.test(String(text))) return []
  return [
    `${file}: launches Chromium directly, so CI (which has no Playwright browser download) cannot start it. Use launchBrowser from ./${LAUNCHER}`,
  ]
}
