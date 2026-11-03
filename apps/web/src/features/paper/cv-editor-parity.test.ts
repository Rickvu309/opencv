import { expect, it } from "vitest"

import blockMenu from "./design/cv-block-menu.layout.json"
import drag from "./design/cv-drag.layout.json"

it("reads the CV pen frames that match without a driver rewrite", () => {
  expect([blockMenu, drag].map((layout) => layout.frameId)).toEqual([
    "F0BP4A",
    "mOKD3",
  ])
})
