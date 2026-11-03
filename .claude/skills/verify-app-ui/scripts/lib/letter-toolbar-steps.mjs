import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath, pathToFileURL } from "node:url"

const crdtEntry = pathToFileURL(
  fileURLToPath(
    new URL("../../../../../packages/paper-crdt/dist/index.js", import.meta.url)
  )
).href

const countOf = (haystack, needle) => haystack.split(needle).length - 1
const findBlocks = (value, predicate, found = []) => {
  if (Array.isArray(value)) {
    for (const item of value) findBlocks(item, predicate, found)
  } else if (value && typeof value === "object") {
    if (predicate(value)) found.push(value)
    for (const item of Object.values(value)) findBlocks(item, predicate, found)
  }
  return found
}
export { countOf }

const textOfBlock = (block) =>
  block.content.map((run) => run.text ?? "").join("")

export const blockTexts = (blocks) =>
  findBlocks(blocks, (value) => Array.isArray(value.content)).map(textOfBlock)

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function spacedCount(blocks, word) {
  const texts = blockTexts(blocks)
  const loose = texts.reduce((sum, text) => sum + countOf(text, word), 0)
  const fenced = new RegExp(
    `(?<=^|[\\s\\p{P}])${escaped(word)}(?=$|[\\s\\p{P}])`,
    "gu"
  )
  const spaced = texts.reduce(
    (sum, text) => sum + (text.match(fenced)?.length ?? 0),
    0
  )
  return { loose, spaced }
}

export function linkedWords(blocks, startsWith, href) {
  const block = findBlocks(
    blocks,
    (value) =>
      Array.isArray(value.content) && textOfBlock(value).startsWith(startsWith)
  )[0]
  if (!block) return null
  return block.content
    .filter((run) => run.href === href)
    .map((run) => run.text)
    .join("")
}

export async function checkKeywordOnce(
  page,
  { check, api },
  docId,
  width,
  word
) {
  const found = spacedCount(await serverBlocks(page, api, docId), word)
  check(
    found.loose === 1 && found.spaced === 1,
    `${width}: the server holds "${word}" exactly once with a space, punctuation or the block edge on each side (${JSON.stringify(found)})`
  )
}

const TYPE_CHOICE = { label: "Heading 2", level: 2 }

export async function serverBlocks(page, api, docId) {
  const { materialize } = await import(crdtEntry)
  const reply = await page.evaluate(
    `fetch(${JSON.stringify(`${api}/api/commands/paper.sync`)},{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({input:{docId:${JSON.stringify(docId)},epoch:0,update:'',stateVector:''},idempotencyKey:crypto.randomUUID()})}).then(r=>r.json())`
  )
  const update = reply.data?.result?.update ?? reply.data?.update ?? ""
  const doc = materialize(new Uint8Array(Buffer.from(update, "base64")))
  return doc.ok ? doc.document.blocks : []
}

export const serverDocument = (page, api, docId) =>
  page.evaluate(
    `fetch(${JSON.stringify(`${api}/api/paper/` + docId)},{credentials:'include'}).then(r=>r.json())`
  )

export async function exerciseToolbar(
  page,
  { check, state, api },
  docId,
  width
) {
  const centerOf = (selector, text) =>
    page.evaluate(`(() => {
      const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})];
      const node=nodes.find(n=>${JSON.stringify(text ?? "")}===""||n.textContent.trim()===${JSON.stringify(text ?? "")});
      if(!node) return null;
      const r=node.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`)
  const clickSelector = async (selector, text) => {
    const at = await centerOf(selector, text)
    check(at, `found ${selector} ${text ?? ""}`)
    await page.hover(at.x, at.y)
    await page.mouse("mousePressed", at.x, at.y)
    await page.mouse("mouseReleased", at.x, at.y)
  }
  const dragSelectWords = async (startsWith) => {
    const line = await page.evaluate(`(() => {
      const node=[...document.querySelectorAll('[data-slot="letter-block-editor"] .bn-inline-content')].find(n=>n.textContent.trim().startsWith(${JSON.stringify(startsWith)}));
      if(!node) return null;
      node.scrollIntoView({block:'center'});
      const r=node.getBoundingClientRect();
      return {x:r.x,y:r.y+9,width:r.width};
    })()`)
    check(line, `found the paragraph that starts "${startsWith}"`)
    const to = line.x + Math.min(70, line.width - 4)
    await page.hover(line.x + 1, line.y)
    await page.mouse("mousePressed", line.x + 1, line.y)
    await page.mouse("mouseMoved", (line.x + to) / 2, line.y)
    await page.mouse("mouseMoved", to, line.y)
    await page.mouse("mouseReleased", to, line.y)
    await state(
      page,
      `getSelection().toString().length>3 && !!document.querySelector('[data-slot="paper-format-toolbar"]')`,
      `${width}: selecting words with the mouse shows the format toolbar`
    )
    return page.evaluate(`getSelection().toString()`)
  }

  const selectedWords = await dragSelectWords("I'm applying")
  await clickSelector('[data-slot="paper-format-toolbar"] [aria-label="Link"]')
  await state(
    page,
    `document.activeElement?.getAttribute('aria-label')==='Link address'`,
    `${width}: the Link button opens the address field with focus in it`
  )
  await sleep(600)
  await state(
    page,
    `!!document.querySelector('[aria-label="Link address"]') && !!document.querySelector('[data-slot="paper-format-toolbar"]')`,
    `${width}: the format toolbar and the address field stay open`
  )
  await page.insertText("example.com")
  await clickSelector('[data-slot="popover-content"] button', "Add")
  const waitServer = async (predicate, message) => {
    let held = false
    for (let i = 0; i < 40 && !held; i += 1) {
      held = predicate(await serverBlocks(page, api, docId))
      if (!held) await sleep(500)
    }
    check(held, message)
  }
  await waitServer(
    (blocks) =>
      linkedWords(blocks, "I'm applying", "https://example.com") ===
      selectedWords,
    `${width}: the server link to https://example.com covers exactly the selected words "${selectedWords}"`
  )
  await dragSelectWords("At my campus")
  await clickSelector(
    '[data-slot="paper-format-toolbar"] [data-slot="dropdown-menu-trigger"]'
  )
  await state(
    page,
    `[...document.querySelectorAll('[role="menuitem"]')].some(n=>n.textContent.trim()===${JSON.stringify(TYPE_CHOICE.label)}) && !!document.querySelector('[data-slot="paper-format-toolbar"]')`,
    `${width}: the block type menu opens and keeps the toolbar`
  )
  await clickSelector('[role="menuitem"]', TYPE_CHOICE.label)
  await waitServer(
    (blocks) =>
      findBlocks(
        blocks,
        (value) =>
          value.type === "heading" &&
          value.level === TYPE_CHOICE.level &&
          JSON.stringify(value).includes("At my campus")
      ).length === 1,
    `${width}: the block that starts "At my campus" is a level ${TYPE_CHOICE.level} heading on the server`
  )
}
