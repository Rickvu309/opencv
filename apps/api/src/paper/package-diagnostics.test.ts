import { describe, expect, it } from "vitest"

import {
  packageDiagnostics,
  renderAdapter,
  type PackageDiagnostic,
} from "./package-diagnostics.js"
import {
  renderMap,
  RenderMapRefusal,
  type AcknowledgedRevision,
} from "./package-render-map.js"

const revision = "11111111-1111-4111-8111-111111111111"
const profile = "paper-safe-surface-one-run-unique-span-2"
const first = `t_${"a".repeat(64)}`
const second = `t_${"b".repeat(64)}`
const acknowledged: AcknowledgedRevision = {
  revision,
  profile,
  targets: [first, second],
}

function code(run: () => unknown) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(RenderMapRefusal)
    return (error as RenderMapRefusal).code
  }
  throw new Error("expected a refusal")
}

function diagnose(entries: Record<string, unknown>[]): PackageDiagnostic[] {
  return [...packageDiagnostics(renderMap(acknowledged), entries)]
}

describe("revision diagnostics", () => {
  it("points an association at exactly one target already on the map", () => {
    const reasons = [
      "date-range",
      "location",
      "column",
      "heading-group",
      "greeting",
    ] as const
    for (const reason of reasons) {
      expect(
        diagnose([
          {
            subject: "association",
            targetId: first,
            reason,
            status: "unsupported",
          },
        ])
      ).toEqual([
        {
          subject: "association",
          targetId: first,
          reason,
          status: "unsupported",
        },
      ])
    }
    expect(
      diagnose([
        {
          subject: "association",
          targetId: second,
          reason: "greeting",
          status: "unknown",
        },
      ])
    ).toEqual([
      {
        subject: "association",
        targetId: second,
        reason: "greeting",
        status: "unknown",
      },
    ])
  })

  it("refuses a new id, a foreign target, or a closed-set miss", () => {
    expect(
      code(() =>
        diagnose([
          {
            subject: "association",
            targetId: [first, second],
            reason: "column",
            status: "unknown",
          },
        ])
      )
    ).toBe("new-target")
    expect(
      code(() =>
        diagnose([
          {
            subject: "association",
            targetId: `t_${"c".repeat(64)}`,
            reason: "location",
            status: "unknown",
          },
        ])
      )
    ).toBe("foreign-target")
    expect(
      code(() =>
        diagnose([
          {
            subject: "association",
            targetId: first,
            reason: "tail",
            status: "unknown",
          },
        ])
      )
    ).toBe("closed-reason")
    expect(
      code(() =>
        diagnose([
          {
            subject: "association",
            targetId: first,
            reason: "column",
            status: "missing",
          },
        ])
      )
    ).toBe("closed-status")
  })

  it("keeps source family and source weight, plus a replacement or an unavailable weight", () => {
    expect(
      diagnose([
        {
          subject: "font",
          sourceFamily: "Times New Roman",
          sourceWeight: "regular",
          replacementFamily: "Liberation Serif",
        },
      ])
    ).toEqual([
      {
        subject: "font",
        sourceFamily: "Times New Roman",
        sourceWeight: "regular",
        replacementFamily: "Liberation Serif",
      },
    ])
    expect(
      diagnose([
        {
          subject: "font",
          sourceFamily: "Wingdings",
          sourceWeight: "regular",
          unavailableWeight: "regular",
        },
      ])
    ).toEqual([
      {
        subject: "font",
        sourceFamily: "Wingdings",
        sourceWeight: "regular",
        unavailableWeight: "regular",
      },
    ])
    expect(
      code(() =>
        diagnose([
          {
            subject: "font",
            sourceFamily: "Calibri",
            sourceWeight: "regular",
          },
        ])
      )
    ).toBe("font-pair")
    expect(
      code(() =>
        diagnose([
          {
            subject: "font",
            sourceFamily: "Calibri",
            sourceWeight: "regular",
            replacementFamily: "Carlito",
            unavailableWeight: "regular",
          },
        ])
      )
    ).toBe("font-pair")
    expect(
      code(() =>
        diagnose([
          {
            subject: "font",
            sourceFamily: "Calibri",
            sourceWeight: "regular",
            replacementFamily: "Carlito (metric-compatible)",
          },
        ])
      )
    ).toBe("ui-string")
  })

  it("names a header gap and a shape gap on their own entries", () => {
    expect(
      diagnose([
        {
          subject: "story",
          name: "word/header1.xml",
          status: "unsupported",
        },
        { subject: "shape", name: "straightConnector1", status: "unknown" },
      ])
    ).toEqual([
      { subject: "story", name: "word/header1.xml", status: "unsupported" },
      { subject: "shape", name: "straightConnector1", status: "unknown" },
    ])
    expect(
      code(() =>
        diagnose([{ subject: "story", name: "", status: "unsupported" }])
      )
    ).toBe("unnamed-gap")
    expect(
      code(() =>
        diagnose([
          {
            subject: "shape",
            name: "The rule stays with the heading.",
            status: "unknown",
          },
        ])
      )
    ).toBe("ui-string")
    expect(
      code(() =>
        diagnose([
          {
            subject: "header",
            name: "word/header1.xml",
            status: "unsupported",
          },
        ])
      )
    ).toBe("second-map")
  })

  it("keeps an image border on the drawing entry", () => {
    expect(
      diagnose([
        {
          subject: "drawing",
          name: "word/media/image1.png",
          border: { width: "12700", color: "000000" },
        },
        { subject: "drawing", name: "word/media/image2.png", border: null },
      ])
    ).toEqual([
      {
        subject: "drawing",
        name: "word/media/image1.png",
        border: { width: "12700", color: "000000" },
      },
      { subject: "drawing", name: "word/media/image2.png", border: null },
    ])
    expect(
      code(() =>
        diagnose([
          { subject: "border", name: "word/media/image1.png", width: "12700" },
        ])
      )
    ).toBe("border-off-drawing")
    expect(
      code(() =>
        diagnose([
          {
            subject: "drawing",
            name: "word/media/image1.png",
            border: { width: "12700", color: "000000", offset: 0 },
          },
        ])
      )
    ).toBe("offset")
  })

  it("returns one map and no warning string", () => {
    const adapter = renderAdapter(acknowledged, [
      {
        subject: "association",
        targetId: first,
        reason: "date-range",
        status: "unsupported",
      },
    ])
    expect(Object.keys(adapter)).toEqual(["map", "diagnostics"])
    expect(adapter.map).toEqual({
      revision,
      profile,
      targets: [first, second],
    })
    expect(JSON.stringify(adapter).match(/"targets"/g)).toEqual(['"targets"'])
    expect(JSON.stringify(adapter)).not.toContain("offset")
    expect(JSON.stringify(adapter)).not.toContain("message")
    expect(
      code(() =>
        diagnose([
          {
            subject: "association",
            targetId: first,
            reason: "greeting",
            status: "unknown",
            message: "Shown on the next page.",
          },
        ])
      )
    ).toBe("ui-string")
  })
})
