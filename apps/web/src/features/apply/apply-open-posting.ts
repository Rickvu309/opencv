/**
 * Clipboard handoff for a posting URL (QVE-248).
 * Open itself is a real `<a target="_blank">` — not window.open.
 */
export async function copyApplyJobUrl(href: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(href)
    return true
  } catch {
    return false
  }
}
