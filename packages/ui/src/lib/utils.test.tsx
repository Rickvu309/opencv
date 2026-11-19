import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("kit cn", () => {
  it("keeps the text-ui type size next to a text colour", () => {
    expect(cn("text-ui text-muted-foreground")).toBe(
      "text-ui text-muted-foreground"
    )
  })

  it("lets a later type size replace text-ui and the other way round", () => {
    expect(cn("text-ui", "text-sm")).toBe("text-sm")
    expect(cn("text-sm", "text-ui")).toBe("text-ui")
  })
})
