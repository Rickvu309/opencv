import assert from "node:assert/strict"
import { join } from "node:path"

export async function proveScaledEditing({ page, editor, out }) {
  const interactionResults = []
  const action = async (name) => {
    const button = page.getByRole("button", { name, exact: true })
    if (!(await button.isVisible()))
      await page
        .getByRole("button", { name: "More formatting", exact: true })
        .click()
    await button.click()
  }
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const first = editor.getByText("Summary", { exact: true }).first()
    await first.click({ clickCount: 3 })
    assert.equal(
      (await page.evaluate(() => getSelection()?.toString())).trim(),
      "Summary"
    )
    await first.scrollIntoViewIfNeeded()
    const point = await first.evaluate((element) => {
      const text = element.firstChild
      const range = document.createRange()
      range.setStart(text, 3)
      range.setEnd(text, 4)
      const rect = range.getBoundingClientRect()
      return { x: rect.left, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(point.x, point.y)
    const caret = await page.evaluate(() => {
      const selection = getSelection()
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      return {
        text: selection.anchorNode.textContent,
        offset: selection.anchorOffset,
        x: rect.left,
        y: rect.top + rect.height / 2,
      }
    })
    assert.equal(caret.text, "Summary")
    assert.ok(
      Math.abs(caret.x - point.x) <= 3,
      JSON.stringify({ point, caret })
    )
    assert.ok(
      Math.abs(caret.y - point.y) <= 3,
      JSON.stringify({ point, caret })
    )
    const previousText = await editor.textContent()
    const expected =
      caret.text.slice(0, caret.offset) + "HIT" + caret.text.slice(caret.offset)
    await page.keyboard.insertText("HIT")
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector(".paper-rich-sheet")
          ?.textContent.includes(expected),
      expected
    )
    await page.keyboard.press("Control+z")
    await page.waitForFunction(
      (text) =>
        document.querySelector(".paper-rich-sheet")?.textContent === text,
      previousText
    )
    assert.equal(await editor.textContent(), previousText)
    await page.keyboard.press("Control+f")
    await page
      .getByRole("textbox", { name: "Find in document", exact: true })
      .fill(": Product designer")
    await page.getByRole("button", { name: "Next match", exact: true }).click()
    await page.waitForFunction(() => {
      const match = document.querySelector("[data-paper-search-active]")
      const pane = document.querySelector("[data-paper-document-pane]")
      if (!match || !pane) return false
      const box = match.getBoundingClientRect(),
        visible = pane.getBoundingClientRect()
      return (
        box.top >= visible.top &&
        box.bottom <= visible.bottom &&
        box.left >= visible.left &&
        box.right <= visible.right
      )
    })
    const match = await page
      .locator("[data-paper-search-active]")
      .evaluate((element) => ({
        text: element.textContent,
        paragraph: element.closest('[data-content-type="paragraph"]')
          .textContent,
        rect: element.getBoundingClientRect().toJSON(),
        pane: document
          .querySelector("[data-paper-document-pane]")
          .getBoundingClientRect()
          .toJSON(),
      }))
    assert.equal(match.text, ": Product designer")
    assert.equal(match.paragraph, "Experience 2: Product designer")
    await page.screenshot({ path: join(out, `find-${width}.png`) })
    await page.getByRole("button", { name: "Close find", exact: true }).click()
    await first.click()
    await action("Insert table")
    await page
      .getByRole("button", { name: "Insert table", exact: true })
      .last()
      .click()
    const table = editor.locator('[data-paper-layout="paperTable"]').last()
    const rows = await table.locator('[data-paper-layout="paperRow"]').count()
    await table.locator('[data-paper-layout="paperCell"]').first().click()
    await page
      .getByRole("button", { name: "Table options", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Insert row below", exact: true })
      .click()
    const newRows = await table
      .locator('[data-paper-layout="paperRow"]')
      .count()
    assert.equal(newRows, rows + 1)
    await page.screenshot({ path: join(out, `table-${width}.png`) })
    await first.click()
    const portrait = await page.evaluate(() => {
      const canvas = document.createElement("canvas")
      canvas.width = 120
      canvas.height = 160
      const draw = canvas.getContext("2d")
      draw.fillStyle = "#e2e8f0"
      draw.fillRect(0, 0, 120, 160)
      draw.fillStyle = "#475569"
      draw.beginPath()
      draw.arc(60, 48, 24, 0, Math.PI * 2)
      draw.fill()
      draw.fillRect(24, 90, 72, 70)
      return canvas.toDataURL("image/png").split(",")[1]
    })
    const photoIds = await editor
      .locator("[data-paper-photo]")
      .evaluateAll((elements) =>
        elements.map((element) => element.dataset.paperPhoto)
      )
    await page.getByLabel("Photo file", { exact: true }).setInputFiles({
      name: "illustrated-portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(portrait, "base64"),
    })
    await page.getByRole("textbox", { name: "Width", exact: true }).fill("160")
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    const photoId = await editor
      .locator("[data-paper-photo]")
      .evaluateAll(
        (elements, previous) =>
          elements
            .map((element) => element.dataset.paperPhoto)
            .find((id) => !previous.includes(id)),
        photoIds
      )
    assert.ok(photoId)
    const photo = editor.locator(`[data-paper-photo="${photoId}"]`)
    await photo.click()
    assert.equal(await photo.getAttribute("aria-pressed"), "true")
    const physicalPhotoWidth = () =>
      photo.evaluate(
        (element) =>
          element.getBoundingClientRect().width /
          Number(
            element
              .closest(".paper-rich-sheet")
              .style.getPropertyValue("--cv-rich-page-scale")
          )
      )
    const initialPhotoWidth = await physicalPhotoWidth()
    assert.ok(Math.abs(initialPhotoWidth - 160) < 1)
    await action("Edit photo")
    await page.getByRole("textbox", { name: "Width", exact: true }).fill("120")
    await page.getByRole("button", { name: "Apply", exact: true }).click()
    const resizedPhotoWidth = await physicalPhotoWidth()
    assert.ok(Math.abs(resizedPhotoWidth - 120) < 1)
    await page.screenshot({ path: join(out, `photo-${width}.png`) })
    interactionResults.push({
      width,
      selection: "Summary",
      caret,
      point,
      undo: "exact text restored",
      match,
      rows,
      newRows,
      photoWidths: [initialPhotoWidth, resizedPhotoWidth],
    })
  }
  return interactionResults
}
