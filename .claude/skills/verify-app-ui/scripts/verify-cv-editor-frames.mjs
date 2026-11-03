import { join } from "node:path"

export async function measureFilledCv({
  page,
  browser,
  web,
  doc,
  output,
  check,
  state,
  compare,
  slash,
  editing,
  blockMenu,
  drag,
  report,
  PANE,
}) {
  const experienceAt = await page.evaluate(`(() => {
    const section = document.querySelector('[data-cv-kind="experience"]')
    if (!section) return null
    const rect = section.getBoundingClientRect()
    return { x: rect.left + 30, y: rect.top + 12 }
  })()`)
  check(experienceAt, "1440: the experience section is on the page")
  await page.hover(experienceAt.x, experienceAt.y)
  await page.sleep(250)
  const openedSlash = await page.evaluate(
    `!!document.querySelector('[aria-label="Add block below"]') && (document.querySelector('[aria-label="Add block below"]').click(), true)`
  )
  check(openedSlash, "1440: a block can be added under Experience")
  await page.sleep(200)
  await page.insertText("/")
  await state(
    page,
    `!!document.querySelector('[data-slot="paper-slash-menu"]')`,
    "1440: the slash menu is open"
  )
  await compare(page, slash, ['[data-slot="paper-slash-menu"]'])
  await page.key("Escape")
  const undoOnce = async () => {
    await page.evaluate(`(() => {
      const undo = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Undo")
      undo?.click()
    })()`)
    await page.sleep(200)
  }
  for (let step = 0; step < 3; step += 1) {
    const slash = await page.evaluate(
      `[...document.querySelectorAll("[data-cv-editor] .bn-inline-content")].some((node) => node.textContent.includes("/"))`
    )
    if (!slash) break
    await undoOnce()
  }
  const emptyParagraph = await page.evaluate(`(() => {
    const node = document.querySelector('[data-content-type="paragraph"] .bn-inline-content')
    return !!node && node.textContent.trim() === ""
  })()`)
  if (emptyParagraph) await undoOnce()
  await state(
    page,
    `![...document.querySelectorAll("[data-cv-editor] .bn-inline-content")].some((node) => node.textContent.includes("/"))`,
    "1440: the slash line is gone"
  )

  await page.evaluate(`document.querySelector('[aria-label="Email"]')?.focus()`)
  await page.sleep(100)
  const typed = await page.evaluate(`(() => {
    const setField = (label, value) => {
      const field = [...document.querySelectorAll("input")].find(
        (el) => el.getAttribute("aria-label") === label
      )
      if (!field) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value)
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
      return true
    }
    return {
      name: setField("Full name", "Linh Nguyen"),
      email: setField("Email", "linh.nguyen@gmail.com"),
      phone: setField("Phone", "090 123 4567"),
      city: setField("City", "Ho Chi Minh City"),
      labels: [...document.querySelectorAll("input")].map((el) => el.getAttribute("aria-label")).filter(Boolean),
    }
  })()`)
  check(
    typed.name && typed.email && typed.phone && typed.city,
    `1440: header fields typed ${JSON.stringify(typed)}`
  )
  await state(
    page,
    `!!document.querySelector('[aria-label="Role"]')`,
    "1440: the experience row has Role"
  )
  const row = await page.evaluate(`(() => {
    const setField = (label, value) => {
      const field = [...document.querySelectorAll("input")].find(
        (el) => el.getAttribute("aria-label") === label
      )
      if (!field) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value)
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
      return true
    }
    return {
      role: setField("Role", "Marketing Intern"),
      company: setField("Company", "Lumière"),
      dates: setField("Dates", "Jun 2025 to now"),
    }
  })()`)
  check(
    row.role && row.company && row.dates,
    "1440: role, company and dates typed"
  )
  await page.evaluate(`document.querySelector('[aria-label="Dates"]')?.focus()`)
  await page.key("Enter")
  await page.key("Enter")
  await state(
    page,
    `!!document.querySelector('[data-content-type="bulletListItem"] .bn-inline-content')`,
    "1440: the first bullet is open"
  )
  const bulletAt = await page.evaluate(`(() => {
    const bullet = document.querySelector("[data-content-type='bulletListItem'] .bn-inline-content")
    if (!bullet) return null
    bullet.focus()
    const rect = bullet.getBoundingClientRect()
    return { x: rect.left + 8, y: rect.top + rect.height / 2 }
  })()`)
  check(bulletAt, "1440: the first bullet can take the caret")
  await page.hover(bulletAt.x, bulletAt.y)
  await page.mouse("mousePressed", bulletAt.x, bulletAt.y, 1)
  await page.mouse("mouseReleased", bulletAt.x, bulletAt.y, 1)
  await page.insertText(
    "Ran 12 social campaigns and grew followers by 38% in four months."
  )
  const split = await page.evaluate(`(() => {
    const root = document.querySelector("[data-cv-editor]")
    const key = Object.keys(root).find((name) => name.startsWith("__reactFiber$"))
    let fiber = root[key]
    let editor = null
    while (fiber) {
      if (fiber.memoizedProps && typeof fiber.memoizedProps.editor?.insertBlocks === "function") {
        editor = fiber.memoizedProps.editor
        break
      }
      fiber = fiber.return
    }
    if (!editor) return false
    const block = editor.getTextCursorPosition().block
    editor.insertBlocks(
      [{ type: "bulletListItem", content: "Wrote weekly TikTok scripts; three passed 100k views." }],
      block,
      "after"
    )
    return true
  })()`)
  check(split, "1440: the second bullet is its own block")
  const phrase = "grew followers by 38%"
  const phraseAt = await page.evaluate(`(() => {
    const needle = ${JSON.stringify(phrase)}
    const texts = []
    for (const node of document.querySelectorAll("[data-content-type='bulletListItem'] .bn-inline-content")) {
      texts.push(node.textContent.slice(0, 120))
      const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let child = walk.nextNode()
      while (child) {
        const at = child.data.indexOf(needle)
        if (at >= 0) {
          const range = document.createRange()
          range.setStart(child, at)
          range.setEnd(child, at + needle.length)
          const rect = range.getBoundingClientRect()
          return { x: rect.left + 1, y: rect.top + rect.height / 2, right: rect.right - 1 }
        }
        child = walk.nextNode()
      }
    }
    return { texts }
  })()`)
  check(
    phraseAt && phraseAt.x,
    `1440: the bold phrase is in the first bullet ${JSON.stringify(phraseAt)}`
  )
  await page.mouse("mouseMoved", phraseAt.x, phraseAt.y)
  await page.mouse("mousePressed", phraseAt.x, phraseAt.y)
  await page.mouse("mouseMoved", phraseAt.right, phraseAt.y)
  await page.mouse("mouseReleased", phraseAt.right, phraseAt.y)
  await page.sleep(200)
  const bold = await page.evaluate(`(() => {
    const button = document.querySelector('[aria-label="Bold"]')
    if (!button) return false
    button.click()
    return true
  })()`)
  check(bold, "1440: Bold is in the format toolbar")
  const planted = await page.evaluate(`(() => {
    const field = [...document.querySelectorAll("input")].find((el) => el.getAttribute("aria-label") === "School")
    if (!field) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, "x")
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "x" }))
    return true
  })()`)
  check(planted, "1440: the school ghost accepts a letter")
  await page.sleep(300)
  await page.evaluate(`document.activeElement?.blur()`)
  await page.sleep(200)
  const school = await page.evaluate(`(() => {
    const field = [...document.querySelectorAll("input")].find((el) => el.getAttribute("aria-label") === "School")
    if (!field) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, "")
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }))
    return true
  })()`)
  check(school, "1440: an empty education row replaces the school ghost")
  await page.sleep(200)
  const again = await page.evaluate(`(() => {
    const needle = ${JSON.stringify(phrase)}
    for (const node of document.querySelectorAll("[data-content-type='bulletListItem'] .bn-inline-content")) {
      const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let child = walk.nextNode()
      while (child) {
        const at = child.data.indexOf(needle)
        if (at >= 0) {
          const range = document.createRange()
          range.setStart(child, at)
          range.setEnd(child, at + needle.length)
          const rect = range.getBoundingClientRect()
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          return { x: rect.left + 1, y: rect.top + rect.height / 2, right: rect.right - 1 }
        }
        child = walk.nextNode()
      }
    }
    return null
  })()`)
  const selected = await page.evaluate(`(() => {
    const root = document.querySelector("[data-cv-editor]")
    const key = Object.keys(root).find((name) => name.startsWith("__reactFiber$"))
    let fiber = root[key]
    let editor = null
    while (fiber) {
      if (fiber.memoizedProps?.editor?.prosemirrorView) {
        editor = fiber.memoizedProps.editor
        break
      }
      fiber = fiber.return
    }
    if (!editor) return "no editor"
    const view = editor.prosemirrorView
    const needle = "grew followers by 38%"
    let found = null
    view.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return
      const at = node.text.indexOf(needle)
      if (at >= 0) found = { from: pos + at, to: pos + at + needle.length }
    })
    if (!found) return "no phrase"
    const Selection = view.state.selection.constructor
    const selection = Selection.create(view.state.doc, found.from, found.to)
    view.dispatch(view.state.tr.setSelection(selection))
    view.focus()
    return "ok"
  })()`)
  check(selected === "ok", `1440: the bold phrase is selected ${selected}`)
  await state(
    page,
    `!!document.querySelector('[data-cv-format-text]')`,
    "1440: the format toolbar is open"
  )
  await compare(page, editing, ['[data-slot="paper-format-toolbar"]'])
  await page.screenshot(join(output, "cv-1440.png"), false)

  const fuller = await page.evaluate(`(() => {
    const setField = (label, value) => {
      const fields = [...document.querySelectorAll("input")].filter(
        (el) => el.getAttribute("aria-label") === label
      )
      const field = fields[fields.length - 1]
      if (!field) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value)
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
      return true
    }
    return {
      school: setField("School", "University of Economics"),
      degree: setField("Degree", "BBA Marketing"),
      years: setField("Years", "2022 to 2026") || setField("Dates", "2022 to 2026"),
      skills: setField("Skills", "Canva, CapCut, Google Analytics, Meta Ads, Excel"),
    }
  })()`)
  check(
    fuller.school && fuller.degree && fuller.years && fuller.skills,
    "1440: education and skills filled"
  )
  const placed = await page.evaluate(`(() => {
    const root = document.querySelector("[data-cv-editor]")
    const key = Object.keys(root).find((name) => name.startsWith("__reactFiber$"))
    let fiber = root[key]
    let editor = null
    while (fiber) {
      if (fiber.memoizedProps && typeof fiber.memoizedProps.editor?.insertBlocks === "function") {
        editor = fiber.memoizedProps.editor
        break
      }
      fiber = fiber.return
    }
    if (!editor) return "no editor"
    const first = editor.document.find((block) => block.type === "paperExperience")
    if (!first) return "no job"
    editor.insertBlocks(
      [{
        type: "paperExperience",
        props: { role: "Content Lead", company: "Business Club", period: "2024 to 2025", location: "" },
        children: [
          { type: "bulletListItem", content: "Wrote a weekly newsletter for 1,200 students with a 52% open rate." },
          { type: "bulletListItem", content: "Led a team of four writers and two designers." },
        ],
      }],
      first,
      "after"
    )
    return "ok"
  })()`)
  check(placed === "ok", `1440: the second job is in the document ${placed}`)
  await page.sleep(250)
  const lead = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll("[data-cv-block-fields]")].find((item) => item.textContent.includes("Content Lead"))
    if (!row) return null
    const rect = row.getBoundingClientRect()
    return { x: rect.left + 24, y: rect.top + 8 }
  })()`)
  check(lead, "1440: the second job row is on the page")
  await page.hover(lead.x, lead.y)
  await page.sleep(250)
  const grip = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll("[data-cv-block-fields]")].find((item) => item.textContent.includes("Content Lead"))
    const handle = document.querySelector('[aria-label="Drag block"]')
    if (!row || !handle) return null
    const rowBox = row.getBoundingClientRect()
    const box = handle.getBoundingClientRect()
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      onRow: box.bottom > rowBox.top - 8 && box.top < rowBox.bottom + 8,
    }
  })()`)
  check(grip && grip.onRow, "1440: the Content Lead grip is beside that row")
  await page.hover(grip.x, grip.y)
  await page.mouse("mousePressed", grip.x, grip.y)
  await page.mouse("mouseReleased", grip.x, grip.y)
  await state(
    page,
    `!!document.querySelector('[data-slot="cv-block-menu"]')`,
    "1440: the block menu is open on the second job"
  )
  await compare(page, blockMenu, [
    '[data-slot="cv-block-menu"]',
    '[role="menu"]',
  ])
  await page.key("Escape")
  await page.sleep(200)
  await compare(page, drag)
  await page.close()

  const phone = await browser.openPage({
    intercept: false,
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: true,
  })
  await phone.goto(`${web}/paper/${doc.id}`)
  await state(
    phone,
    `!!document.querySelector('[aria-label="Full name"]')`,
    "390: the CV editor shows the name field"
  )
  const short = await phone.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(PANE)})
    return [...root.querySelectorAll("button, input")].flatMap((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return []
      const name = el.getAttribute("aria-label") || el.textContent.trim().slice(0, 40)
      if (rect.height >= 44) return []
      return [{ name, width: rect.width, height: rect.height }]
    })
  })()`)
  report.shortTargets = short
  await phone.screenshot(join(output, "cv-390.png"), false)
  check(
    short.length === 0,
    `390: phone hit areas are at least 44px` +
      short
        .slice(0, 12)
        .map((item) => `\n  ${item.name} ${item.width}x${item.height}`)
        .join("")
  )
  await phone.close()
  check(!report.layoutFailed, "pen layouts match")
  report.status = "PASS"
}
