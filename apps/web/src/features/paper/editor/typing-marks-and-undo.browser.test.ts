import type { Page } from "playwright-core"
import { describe, expect, it } from "vitest"

import {
  compose,
  paperEditorPages,
  texts,
} from "../../../test/paper-editor-harness"

const open = paperEditorPages()

const boldRuns = (page: Page) =>
  page.evaluate(() =>
    window
      .paperLab!.read()
      .doc.content.flatMap((block) =>
        block.type === "text_block"
          ? (block.content ?? []).map((run) =>
              run.type === "text"
                ? [run.text, (run.marks ?? []).some((m) => m.type === "bold")]
                : ["\n", false]
            )
          : []
      )
  )

async function composeInSafariOrder(page: Page, states: string[]) {
  await page.evaluate((steps) => {
    const input = document.querySelector<HTMLTextAreaElement>(".paper-input")!
    const start = input.selectionStart
    let length = input.selectionEnd - start
    const set = (text: string) => {
      input.setRangeText(text, start, start + length, "end")
      length = text.length
    }
    const fire = (type: string, inputType: string, data: string | null) =>
      input.dispatchEvent(
        new InputEvent(type, {
          bubbles: true,
          cancelable: type === "beforeinput",
          inputType,
          data,
        })
      )
    input.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }))
    for (const step of steps) {
      fire("beforeinput", "insertCompositionText", step)
      set(step)
      fire("input", "insertCompositionText", step)
    }
    const commit = steps.at(-1)!
    input.dispatchEvent(
      new CompositionEvent("compositionend", { data: commit })
    )
    fire("beforeinput", "deleteCompositionText", null)
    set("")
    fire("input", "deleteCompositionText", null)
    fire("beforeinput", "insertFromComposition", commit)
    set(commit)
    fire("input", "insertFromComposition", commit)
  }, states)
}

const canUndo = (page: Page) =>
  page.evaluate(() => window.paperLab!.history().undo)

describe("bold and undo while typing on the new Paper page", () => {
  it("keeps bold for the next letter after Backspace deletes the bold word", async () => {
    const page = await open("blank")
    await page.keyboard.type("two ")
    await page.keyboard.press("Control+b")
    await page.keyboard.type("xy")
    await page.keyboard.press("Backspace")
    await page.keyboard.press("Backspace")
    await page.keyboard.type("z")
    expect(await boldRuns(page)).toEqual([
      ["two ", false],
      ["z", true],
    ])
    await page.context().close()
  })

  it("keeps a bold composed word bold when Safari deletes and reinserts it", async () => {
    const page = await open("blank")
    await page.keyboard.press("Control+b")
    await composeInSafariOrder(page, ["h", "ha", "hai"])
    await page.keyboard.press("Control+b")
    await page.keyboard.type(" ")
    await composeInSafariOrder(page, ["b", "ba"])
    expect(await boldRuns(page)).toEqual([
      ["hai", true],
      [" ba", false],
    ])
    expect(await page.locator(".paper-composition").count()).toBe(0)
    await page.context().close()
  })

  it("takes back one composed word with its space and bold toggles in one Undo", async () => {
    const page = await open("blank")
    await compose(page, ["T", "Ti", "Tie", "Tiê", "Tiên", "Tiêng", "Tiếng"])
    await page.keyboard.type(" ")
    await page.keyboard.press("Control+b")
    await compose(page, ["V", "Vi", "Vie", "Viê", "Viêt", "Việt"])
    await page.keyboard.press("Control+b")
    await page.keyboard.type(".")
    expect(await texts(page)).toEqual(["Tiếng Việt."])
    await page.keyboard.press("Control+z")
    expect(await texts(page)).toEqual(["Tiếng "])
    await page.keyboard.press("Control+z")
    expect(await texts(page)).toEqual([""])
    expect(await canUndo(page)).toBe(false)
    await page.context().close()
  })

  it("takes back one Safari-order composed word with its punctuation in one Undo", async () => {
    const page = await open("blank")
    await composeInSafariOrder(page, ["h", "ha", "hai"])
    await page.keyboard.type(" ")
    await composeInSafariOrder(page, ["b", "ba"])
    await page.keyboard.type(",")
    expect(await texts(page)).toEqual(["hai ba,"])
    await page.keyboard.press("Control+z")
    expect(await texts(page)).toEqual(["hai "])
    await page.keyboard.press("Control+z")
    expect(await texts(page)).toEqual([""])
    expect(await canUndo(page)).toBe(false)
    await page.context().close()
  })
})
