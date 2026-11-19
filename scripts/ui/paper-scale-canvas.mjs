import assert from "node:assert/strict"
import { join } from "node:path"

export async function proveWordCanvas({ page, state, out }) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${state.webOrigin}/paper`)
  await page.getByRole("button", { name: "New", exact: true }).click()
  await page.getByRole("button", { name: "CV", exact: true }).click()
  await page.getByRole("radio", { name: "Blank", exact: true }).click()
  await page.getByRole("button", { name: "Start blank", exact: true }).click()
  const canvas = page.locator('.writing-page[contenteditable="true"]')
  await canvas.waitFor()
  const longText = Array.from(
    { length: 28 },
    (_, index) =>
      `Experience ${index + 1}: Led research and prototyping for a career workspace. Collaborated with engineers to ship accessible workflows and improve outcomes for new graduates.`
  ).join("\n")
  await canvas.click()
  for (const line of longText.split("\n")) {
    await page.keyboard.insertText(line)
    await page.keyboard.press("Enter")
  }
  await page.waitForFunction(
    (text) =>
      document
        .querySelector(".writing-page")
        .textContent.replaceAll("\u200b", "")
        .replaceAll("\n", "") === text.replaceAll("\n", ""),
    longText
  )
  const canvasResults = []
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForFunction(() => {
      const sheet = document.querySelector(".writing-page"),
        pane = document.querySelector(".writing-scroll")
      const css = getComputedStyle(pane)
      return (
        Math.abs(
          sheet.getBoundingClientRect().width / sheet.offsetWidth -
            Math.min(
              1,
              (pane.clientWidth -
                parseFloat(css.paddingLeft) -
                parseFloat(css.paddingRight)) /
                816
            )
        ) < 0.0001
      )
    })
    const value = await canvas.evaluate((sheet) => {
      const rect = sheet.getBoundingClientRect(),
        css = getComputedStyle(sheet)
      const scale = rect.width / sheet.offsetWidth
      const lines = []
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        for (let i = 0; i < node.length; i++) {
          const range = document.createRange()
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const box = range.getBoundingClientRect()
          if (!box.width || !box.height) continue
          const y = (box.top - rect.top) / scale
          let line = lines.find((line) => Math.abs(line.y - y) < 1)
          if (!line) {
            line = { y, text: "" }
            lines.push(line)
          }
          line.text += node.textContent[i]
        }
      }
      const pane = document.querySelector(".writing-scroll"),
        frame = pane.getBoundingClientRect()
      return {
        scale,
        width: rect.width / scale,
        height: rect.height / scale,
        margin: parseFloat(css.paddingLeft),
        lines,
        horizontalOverflow: pane.scrollWidth - pane.clientWidth,
        cropped: rect.left < frame.left - 1 || rect.right > frame.right + 1,
      }
    })
    assert.ok(Math.abs(value.width - 816) < 1)
    assert.equal(value.margin, 96)
    assert.ok(value.height > 1056)
    assert.ok(value.horizontalOverflow <= 1 && !value.cropped)
    if (canvasResults.length) {
      const reference = canvasResults[0]
      assert.ok(
        Math.abs(
          value.width / value.height - reference.width / reference.height
        ) < 0.001
      )
      assert.deepEqual(
        value.lines.map((line) => line.text),
        reference.lines.map((line) => line.text)
      )
      assert.ok(Math.abs(value.height - reference.height) < 1)
    }
    await page.evaluate(() => {
      document.querySelector(".writing-scroll").scrollTop = 0
    })
    const screenshot = join(out, `canvas-${width}.png`)
    await page.screenshot({ path: screenshot })
    canvasResults.push({ viewport: width, ...value, screenshot })
  }
  return canvasResults
}
