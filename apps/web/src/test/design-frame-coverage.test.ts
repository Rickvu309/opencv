// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import manifest from "./design-frames.json"

const PENDING_FRAMES: Record<string, { issue: number; expires: string }> = {
  Cs3hj: { issue: 498, expires: "2026-12-31" },
  EKv2D: { issue: 498, expires: "2026-12-31" },
  FUipv: { issue: 498, expires: "2026-12-31" },
  ISnTZ: { issue: 498, expires: "2026-12-31" },
  lOO77: { issue: 498, expires: "2026-12-31" },
  kfJuz: { issue: 498, expires: "2026-12-31" },
  Vm0eJ: { issue: 498, expires: "2026-12-31" },
  wiQ9M: { issue: 498, expires: "2026-12-31" },
  kmUTI: { issue: 498, expires: "2026-12-31" },
  YC0lV: { issue: 498, expires: "2026-12-31" },
  mkEKx: { issue: 498, expires: "2026-12-31" },
  VH2fp: { issue: 498, expires: "2026-12-31" },
  O7zOJK: { issue: 498, expires: "2026-12-31" },
  YCAbn: { issue: 498, expires: "2026-12-31" },
  aZiLz: { issue: 498, expires: "2026-12-31" },
  jcbPS: { issue: 498, expires: "2026-12-31" },
  DPAVo: { issue: 498, expires: "2026-12-31" },
  Uh2Ku: { issue: 498, expires: "2026-12-31" },
  gWPIB: { issue: 498, expires: "2026-12-31" },
  k8HycK: { issue: 498, expires: "2026-12-31" },
  qCgR7: { issue: 498, expires: "2026-12-31" },
  LiQPl: { issue: 498, expires: "2026-12-31" },
  K5FuN: { issue: 498, expires: "2026-12-31" },
  U6XwWT: { issue: 498, expires: "2026-12-31" },
  vOOtp: { issue: 498, expires: "2026-12-31" },
  dgd0V: { issue: 498, expires: "2026-12-31" },
  LG57z: { issue: 498, expires: "2026-12-31" },
  L3V6y: { issue: 1063, expires: "2026-12-03" },
  pCOLZ: { issue: 1063, expires: "2026-12-03" },
  TtBmY: { issue: 1063, expires: "2026-12-03" },
}

const TODAY = new Date().toISOString().slice(0, 10)
const srcDir = fileURLToPath(new URL("..", import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full)
    return [full]
  })
}

const all = files(srcDir)
const snapshots = all.filter((file) =>
  /\.(snapshot|layout)\.(json|ts)$/.test(path.basename(file))
)

function resolveImport(testFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return path.join(srcDir, specifier.slice(2))
  if (specifier.startsWith("."))
    return path.resolve(path.dirname(testFile), specifier)
  return null
}

const imported = new Set(
  all
    .filter((file) => /\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      ts
        .preProcessFile(readFileSync(file, "utf8"), true, true)
        .importedFiles.flatMap(({ fileName }) => {
          const target = resolveImport(file, fileName)
          return target ? [target, `${target}.ts`, `${target}.json`] : []
        })
    )
)

function frameIdOf(file: string): string | null {
  const match = /"?frameId"?\s*:\s*"([^"]+)"/.exec(readFileSync(file, "utf8"))
  return match?.[1] ?? null
}

const covered = new Map<string, string>()
for (const file of snapshots) {
  const id = frameIdOf(file)
  if (id && imported.has(file)) covered.set(id, path.relative(srcDir, file))
}

describe("every release frame has a parity snapshot a test reads, or an unexpired pending entry", () => {
  it("every release frame has a parity snapshot a test reads, or a pending entry", () => {
    const problems = manifest.frames
      .filter((frame) => !covered.has(frame.id) && !PENDING_FRAMES[frame.id])
      .map(
        (frame) =>
          `${frame.name} (${frame.id}) has no parity snapshot. Run node scripts/pen-snapshot.mjs <opencv.pen> ${frame.id} apps/web/src/features/<surface>/design/<name>.snapshot.json and read it from a test that compares the screen to the frame, like features/auth/auth-design-parity.test.tsx.`
      )
    expect(problems).toEqual([])
  })

  it("pending entries are still needed, known and not expired", () => {
    const ids = new Set(manifest.frames.map((frame) => frame.id))
    const problems = Object.entries(PENDING_FRAMES).flatMap(([id, entry]) => {
      if (!ids.has(id))
        return [
          `${id} is not a release frame in design-frames.json. Remove it from PENDING_FRAMES.`,
        ]
      if (covered.has(id))
        return [
          `${id} is covered by ${covered.get(id)}. Remove it from PENDING_FRAMES.`,
        ]
      if (entry.expires < TODAY)
        return [
          `${id} expired on ${entry.expires}. Build it from the pen (#${entry.issue}), or get the operator to extend it.`,
        ]
      return []
    })
    expect(problems).toEqual([])
  })
})
