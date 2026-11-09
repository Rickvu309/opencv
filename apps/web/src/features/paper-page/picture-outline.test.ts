import { expect, it } from "vitest"

import { paintPictureOutlines, pictureOutlines } from "./picture-outline.ts"

const A = "http://schemas.openxmlformats.org/drawingml/2006/main"

function picture(line: string) {
  return `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:a="${A}"><pic:spPr>${line}</pic:spPr></pic:pic>`
}

const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  ${picture(`<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>`)}
  ${picture("<a:ln/>")}
  ${picture(`<a:ln w="25400"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln>`)}
</w:body></w:document>`

it("paints an outline only where the line has width and a color", () => {
  expect(pictureOutlines(documentXml)).toEqual([
    { px: 1, color: "#000000" },
    null,
    { px: 2, color: "#FF0000" },
  ])
  const root = document.createElement("div")
  root.innerHTML = `<article><img alt="one"/><img alt="two"/><img alt="three"/></article>`
  paintPictureOutlines(root, documentXml)
  const images = [...root.querySelectorAll("img")]
  expect(images[0]).toHaveStyle({ outline: "1px solid #000000" })
  expect(images[1]?.style.outline).toBe("")
  expect(images[2]).toHaveStyle({ outline: "2px solid #FF0000" })
})
