import { describe, expect, it } from "vitest"

import * as barrel from "./must-edit.js"

const TRUNK_EXPORTS = [
  "MUST_EDIT_TOOLS",
  "applyRewriteToFocusContent",
  "describeExperienceRoles",
  "describeFocusDoc",
  "extractMustEditReplacement",
  "findFocusRewriteOriginal",
  "freeMustEditLinePrompt",
  "isExperienceNamedMiss",
  "isPaperEditAsk",
  "isRealRewrite",
  "isToolDumpText",
  "latestUserText",
  "localRewriteText",
  "mustEditMissCopy",
  "mustEditNoRewriteCopy",
  "mustEditPrepareStep",
  "mustEditStillNeedsUpdate",
  "mustEditToolChoice",
  "mustEditTurnInstruction",
  "namedOtherCvSection",
  "namesExperienceOrBullet",
  "sanitizeMustEditLine",
  "shouldUseFreeTextMustEdit",
  "stripMustEditThinking",
  "stripToolDumpText",
  "textNamesExperienceRole",
  "toCoachFocusDoc",
  "toolNamesFromSteps",
]

describe("must-edit barrel", () => {
  it("exports the same runtime names as before the split", () => {
    expect(Object.keys(barrel).sort()).toEqual([...TRUNK_EXPORTS].sort())
  })
})
