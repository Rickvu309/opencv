import {
  PAPER_PACKAGE_LIMITS,
  PAPER_PACKAGE_PROJECTOR,
  paperWordReadSchema,
  type WordPage,
  type WordParagraph,
} from "@workspace/domain"

import {
  decodePackageCursor,
  encodePackageCursor,
  packageCursorSigned,
  packageFailure,
} from "./package-pages.js"
import { wordReadingBasis } from "./package-store.js"
import { open } from "./word/document.js"

async function reading(
  owner: string,
  input: { docId: string; at?: string; cursor?: string }
) {
  const basis = await wordReadingBasis(owner, {
    docId: input.docId,
    ...(input.at === undefined ? {} : { at: input.at }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
  })
  const page = await open(owner, {
    kind: "read",
    doc: input.docId,
    at: basis.metadata.revision,
  })
  if ("refused" in page) return packageFailure(page.message)
  let index = 0
  let offset = 0
  if (input.cursor) {
    const token = decodePackageCursor(input.cursor)
    const position = token.position
    if (
      position.reader !== "word" ||
      position.docId !== input.docId ||
      position.revision !== page.revision ||
      (input.at !== undefined && input.at !== page.revision) ||
      position.incarnation !== basis.incarnation ||
      !packageCursorSigned(token, owner, basis.key)
    )
      return packageFailure("This page belongs to another document or version.")
    index = position.index
    offset = position.offset
    const line = page.paragraphs[index]
    if (
      !line ||
      offset > line.text.length ||
      (offset > 0 && /[\uD800-\uDBFF]/.test(line.text[offset - 1] ?? ""))
    )
      return packageFailure(
        "This page link is invalid. Read the document again."
      )
  }
  const cursor = (index: number, offset: number) =>
    index < page.paragraphs.length
      ? encodePackageCursor(
          {
            docId: page.doc,
            revision: page.revision,
            incarnation: basis.incarnation,
            projector: PAPER_PACKAGE_PROJECTOR,
            reader: "word",
            index,
            offset,
          },
          owner,
          basis.key
        )
      : null
  return { ...basis, page, index, offset, cursor }
}

function scalarPrefix(text: string, maxChars: number) {
  let end = Math.max(0, Math.min(text.length, maxChars))
  if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1] ?? "")) end--
  return text.slice(0, end)
}

export async function readWordParagraphs(
  owner: string,
  input: { docId: string; at?: string; cursor?: string }
) {
  const read = await reading(owner, input)
  let { index, offset } = read
  const paragraphs: {
    handle: string
    text: string
    held: boolean
    message: string
    complete: boolean
    continuation: boolean
  }[] = []
  const result = () => ({
    ...read.metadata,
    paragraphs,
    nextCursor: read.cursor(index, offset),
  })
  while (
    index < read.page.paragraphs.length &&
    paragraphs.length < PAPER_PACKAGE_LIMITS.pageRegions
  ) {
    const line = read.page.paragraphs[index]
    if (!line) break
    let text = ""
    let bytes = 0
    for (const scalar of line.text.slice(offset)) {
      const size = Buffer.byteLength(scalar)
      if (bytes + size > PAPER_PACKAGE_LIMITS.textBytes) break
      text += scalar
      bytes += size
    }
    const complete = offset + text.length === line.text.length
    paragraphs.push({
      handle: line.handle,
      text,
      held: line.held,
      message: line.message,
      complete,
      continuation: offset > 0,
    })
    const nextIndex = complete ? index + 1 : index
    const nextOffset = complete ? 0 : offset + text.length
    if (
      Buffer.byteLength(
        JSON.stringify({
          ok: true,
          data: {
            ...read.metadata,
            paragraphs,
            nextCursor: read.cursor(nextIndex, nextOffset),
          },
        })
      ) > PAPER_PACKAGE_LIMITS.pageBytes
    ) {
      paragraphs.pop()
      break
    }
    index = nextIndex
    offset = nextOffset
  }
  if (paragraphs.length === 0 && index < read.page.paragraphs.length)
    return packageFailure("This Word paragraph is too large to read safely.")
  return paperWordReadSchema.parse(result())
}

function remaining(page: WordPage, index: number, offset: number) {
  return {
    omittedParagraphs: page.paragraphs.length - index,
    omittedChars: page.paragraphs
      .slice(index)
      .reduce(
        (total, line, relative) =>
          total + [...line.text.slice(relative === 0 ? offset : 0)].length,
        0
      ),
  }
}

function documentText(text: string) {
  return text.replace(/[\r\n\u2028\u2029]/g, "\u21b5")
}

function outlineLine(
  line: WordParagraph,
  text: string,
  selected: ReadonlySet<string>,
  continuation: boolean,
  complete = true
) {
  const mark = selected.has(line.handle) ? ">> " : ""
  const held = line.held ? ` [held: ${line.message}]` : ""
  const continued = continuation ? " [continued]" : ""
  const partial = complete
    ? ""
    : " [partial: read the next part before editing]"
  return `${mark}[line ${line.handle}]${held}${continued}${partial} ${text === "" ? "(empty line)" : documentText(text)}`
}

export async function readWordOutline(
  owner: string,
  input: { docId: string; cursor?: string },
  blockIds: readonly string[] | undefined,
  maxChars: number
) {
  const read = await reading(owner, input)
  let { index, offset } = read
  const selected = new Set(blockIds ?? [])
  const lines = [
    `Saved revision ${read.page.revision}`,
    "Word lines for setText, insert and delete:",
  ]
  const suffix = (at: number, from: number) => {
    const cursor = read.cursor(at, from)
    if (!cursor) return ""
    const left = remaining(read.page, at, from)
    return `\nUnread remainder: ${left.omittedParagraphs} paragraphs, ${left.omittedChars} text characters. Call paper_outline with cursor ${cursor} to read the next part. Do not claim to have read the whole document.`
  }
  while (index < read.page.paragraphs.length) {
    const line = read.page.paragraphs[index]
    if (!line) break
    const text = line.text.slice(offset)
    const full = outlineLine(line, text, selected, offset > 0)
    if (
      [...lines, full].join("\n").length + suffix(index + 1, 0).length <=
      maxChars
    ) {
      lines.push(full)
      index++
      offset = 0
      continue
    }
    const room =
      maxChars -
      lines.join("\n").length -
      1 -
      outlineLine(line, "", selected, offset > 0, false).length -
      suffix(index, offset).length
    const partial = scalarPrefix(text, room)
    if (partial.length > 0) {
      lines.push(outlineLine(line, partial, selected, offset > 0, false))
      offset += partial.length
    }
    break
  }
  const nextCursor = read.cursor(index, offset)
  const outline = lines.join("\n") + suffix(index, offset)
  return {
    revision: read.page.revision,
    outline: scalarPrefix(outline, maxChars),
    truncated: nextCursor !== null,
    nextCursor,
    ...remaining(read.page, index, offset),
  }
}
