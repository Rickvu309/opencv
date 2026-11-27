import { mainXml } from "../../lib/paper-canvas-bytes.mjs"

export function wordFileFacts(xml) {
  const size = /<w:pgSz\b[^>]*?w:w="(\d+)"[^>]*?w:h="(\d+)"/.exec(xml)
  return {
    headings: [...xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((style) => /^(heading\d|title)$/i.test(style)),
    hyperlinks: (xml.match(/<w:hyperlink\b/g) ?? []).length,
    page: size
      ? { width: Number(size[1]), height: Number(size[2]) }
      : { width: 0, height: 0 },
  }
}

export const wordBytesFacts = (bytes) => wordFileFacts(mainXml(bytes))
