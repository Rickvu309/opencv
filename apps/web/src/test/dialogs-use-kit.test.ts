// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))
const NOT_PRODUCT_CODE =
  /\.(?:test|type-test|spec|stories|fixtures)\.[cm]?[jt]sx?$/
const KIT_DIALOG = "@workspace/ui/components/dialog"

const DIALOG_MARKERS = [
  /<DialogContent\b/,
  /@base-ui\/react\/(?:alert-)?dialog/,
  /<dialog\b/,
  /role=["'{]+(?:alert)?dialog/,
]

export function rendersDialog(source: string) {
  return DIALOG_MARKERS.some((marker) => marker.test(source))
}

export function dialogBypassesKit(source: string): string[] {
  const reasons: string[] = []
  if (/@base-ui\/react\/(?:alert-)?dialog/.test(source))
    reasons.push("imports the Base UI dialog instead of the kit")
  if (/<dialog\b/.test(source)) reasons.push("renders a native dialog element")
  if (/role=["'{]+(?:alert)?dialog/.test(source))
    reasons.push("hand-builds a dialog role")
  if (
    /<DialogContent\b/.test(source) &&
    !new RegExp(
      `import\\s*\\{[^}]*\\bDialogContent\\b[^}]*\\}\\s*from\\s*["']${KIT_DIALOG}["']`
    ).test(source)
  )
    reasons.push("renders a DialogContent that is not the kit's")
  return reasons
}

function productFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return productFiles(full)
    return /\.tsx$/.test(entry.name) && !NOT_PRODUCT_CODE.test(entry.name)
      ? [full]
      : []
  })
}

export function webDialogFiles() {
  return productFiles(srcDir)
    .map((file) => ({
      file: path.relative(srcDir, file),
      source: readFileSync(file, "utf8"),
    }))
    .filter(({ source }) => rendersDialog(source))
}

describe("every web dialog renders through the kit dialog, which keeps Tab inside", () => {
  const dialogs = webDialogFiles()

  it("finds the dialogs from the code", () => {
    expect(dialogs.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        "features/paper/paper-library.tsx",
        "features/apply/apply-new-job-dialog.tsx",
      ])
    )
  })

  it.each(dialogs.map(({ file, source }) => [file, source]))(
    "%s uses the kit dialog",
    (_file, source) => {
      expect(dialogBypassesKit(source)).toEqual([])
    }
  )

  it("fires on a dialog that skips the kit", () => {
    const mistakes = [
      `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"\n<DialogPrimitive.Popup />`,
      `import { AlertDialog } from "@base-ui/react/alert-dialog"`,
      `<dialog open><button>Delete</button></dialog>`,
      `<div role="dialog" aria-modal="true" />`,
      `import { DialogContent } from "./my-dialog"\n<DialogContent />`,
    ]
    for (const mistake of mistakes) {
      expect(rendersDialog(mistake)).toBe(true)
      expect(dialogBypassesKit(mistake)).not.toEqual([])
    }
  })

  it("stays quiet on a kit dialog", () => {
    const clean = `import {\n  Dialog,\n  DialogContent,\n} from "${KIT_DIALOG}"\n<Dialog open><DialogContent /></Dialog>`
    expect(rendersDialog(clean)).toBe(true)
    expect(dialogBypassesKit(clean)).toEqual([])
  })
})
