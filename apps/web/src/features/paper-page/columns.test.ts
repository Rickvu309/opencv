import { expect, it } from "vitest"

import { columnPlans, paintColumns } from "./columns.ts"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

const documentXml = `<w:document xmlns:w="${W}"><w:body>
  <w:p><w:r><w:t>April 30, 2023</w:t><w:br w:type="column"/></w:r></w:p>
  <w:p><w:r><w:t>City, State</w:t></w:r></w:p>
  <w:sectPr>
    <w:cols w:num="2" w:space="720">
      <w:col w:w="2880" w:space="720"/>
      <w:col w:w="6480"/>
    </w:cols>
  </w:sectPr>
</w:body></w:document>`

it("reads the source column widths and turns css columns off", () => {
  const [plan] = columnPlans(documentXml)
  expect(plan?.left).toEqual(["April 30, 2023"])
  expect(plan?.right).toEqual(["City, State"])
  expect(plan?.leftPx).toBe(192)
  expect(plan?.gapPx).toBe(48)
  const root = document.createElement("div")
  root.innerHTML = `<section class="docx"><article style="column-count: 2">
    <p>April 30, 2023</p><p>City, State</p>
  </article></section>`
  paintColumns(root, documentXml)
  const article = root.querySelector("article")
  const row = root.querySelector(".source-columns")
  expect(article).toHaveStyle({ columnCount: "1" })
  expect((row as HTMLElement).style.gridTemplateColumns).toBe(
    "192px minmax(12px,48px) minmax(0,432px)"
  )
  expect(row?.children[0]?.textContent).toBe("April 30, 2023")
  expect(row?.children[2]?.textContent).toBe("City, State")
})
