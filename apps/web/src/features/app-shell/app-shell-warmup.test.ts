import { expect, it, vi } from "vitest"

const editor = vi.hoisted(() => {
  let release = () => {}
  let entered = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  return { gate, started, release, entered }
})

vi.mock("@/features/paper/paper-cv-editor.tsx", async () => {
  editor.entered()
  await editor.gate
  return { PaperCvEditor: () => null }
})

it("waits for a deferred nested CV editor before the first app test starts", async () => {
  const warming = import("@/test/warm-routes.ts")
  try {
    const first = await Promise.race([
      editor.started.then(() => "editor requested"),
      warming.then(() => "warmup finished"),
    ])
    expect(first).toBe("editor requested")
    let finished = false
    void warming.then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
  } finally {
    editor.release()
    await warming
  }
})
