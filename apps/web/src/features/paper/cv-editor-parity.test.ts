import { expect, it } from "vitest"

import blockMenu from "./design/cv-block-menu.layout.json"
import blank from "./design/cv-blank.layout.json"
import drag from "./design/cv-drag.layout.json"
import editing from "./design/cv-editing.layout.json"
import slash from "./design/cv-slash.layout.json"

it("reads the CV pen frames the editor driver measures", () => {
  expect(
    [blank, slash, editing, blockMenu, drag].map((layout) => layout.frameId)
  ).toEqual(["L3V6y", "pCOLZ", "TtBmY", "F0BP4A", "mOKD3"])
})
