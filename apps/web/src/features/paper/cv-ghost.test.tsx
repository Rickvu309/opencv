import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { structuredCv } from "@/test/paper-structured-cv.ts"
import { afterEach, beforeAll, expect, it } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"

import { PaperEditorEngine } from "./paper-editor-engine.tsx"

beforeAll(() => {
  installEditorPolyfills()
  if (typeof document.elementsFromPoint !== "function") {
    document.elementsFromPoint = () => []
  }
})
afterEach(() => {
  document.documentElement.removeAttribute("data-cv-dragging")
  cleanup()
})

async function mount() {
  const client = seededCvClient(structuredCv())
  act(() => {
    render(
      <PaperEditorEngine
        kind="cv"
        client={client}
        generation={1}
        label="CV"
        onDocument={() => undefined}
        onSelectedBlocks={() => undefined}
      />
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  return client
}

it("splits a typed skills row into three items and keeps the section title", async () => {
  const client = await mount()
  const user = userEvent.setup({ delay: null })
  const skills = screen.getByRole("textbox", { name: "Skills" })
  await user.click(skills)
  await user.keyboard("Canva, CapCut, Google Analytics")
  await act(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => resolve(undefined))
    )
  })
  const text = JSON.stringify(client.document())
  expect(text).not.toContain("Skillsva")
  expect(text).toContain('"title":"Skills"')
  const skillsBlock = client
    .document()
    ?.blocks.find((block) => block.type === "skills")
  const items = skillsBlock && "items" in skillsBlock ? skillsBlock.items : []
  expect(items).toEqual(["Canva", "CapCut", "Google Analytics"])
})

it("keeps the bullet line after a role is typed", async () => {
  const client = await mount()
  fireEvent.input(screen.getByRole("textbox", { name: "Role" }), {
    target: { value: "Marketing Intern" },
  })
  const job = client
    .document()
    ?.blocks.find((block) => block.type === "experience")
  const children = job && "children" in job ? job.children : []
  expect(children.some((child) => child.type === "bullet")).toBe(true)
  expect(document.querySelector("[data-cv-bullet='ghost']")).toBeNull()
  expect(document.querySelector("[data-cv-bullet]")).not.toBeNull()
})

it("marks a drag until the handle is released", async () => {
  await mount()
  const grip = document.createElement("div")
  grip.setAttribute("aria-label", "Drag block")
  document.body.append(grip)
  fireEvent.dragStart(grip)
  expect(document.documentElement.hasAttribute("data-cv-dragging")).toBe(true)
  const over = new Event("dragover", { bubbles: true, cancelable: true })
  document.dispatchEvent(over)
  expect(over.defaultPrevented).toBe(true)
  fireEvent.dragEnd(grip)
  expect(document.documentElement.hasAttribute("data-cv-dragging")).toBe(false)
  grip.remove()
})
