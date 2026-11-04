import { expect, it } from "vitest"

import blank from "./design/cv-blank.layout.json"
import blockMenu from "./design/cv-block-menu.layout.json"
import drag from "./design/cv-drag.layout.json"
import editing from "./design/cv-editing.layout.json"
import slash from "./design/cv-slash.layout.json"

it("reads the five CV pen frames", () => {
  expect(
    [blank, slash, editing, blockMenu, drag].map((layout) => layout.frameId)
  ).toEqual(["L3V6y", "pCOLZ", "TtBmY", "F0BP4A", "mOKD3"])
})
