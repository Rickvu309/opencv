import { describe, expect, it } from "vitest"

import { validateApplySearch } from "./apply-search.ts"

describe("Apply URL search", () => {
  it("keeps both filters with the selected calendar span", () => {
    expect(
      validateApplySearch({
        view: "calendar",
        span: "week",
        company: " NORTHWIND ",
        location: "hAnOi",
      })
    ).toEqual({
      view: "calendar",
      span: "week",
      company: " NORTHWIND ",
      location: "hAnOi",
    })
  })

  it("drops empty filters and unsupported search fields", () => {
    expect(
      validateApplySearch({
        view: "board",
        company: "",
        location: "",
        open: "guide",
      })
    ).toEqual({})
  })

  it.each([null, 123, true, ["Hanoi"], { name: "Hanoi" }])(
    "rejects a non-text filter: %j",
    (value) => {
      expect(validateApplySearch({ company: value, location: value })).toEqual(
        {}
      )
    }
  )

  it.each(["123", "true", "Northwind & partners", "Hồ Chí Minh"])(
    "keeps text without changing it: %s",
    (value) => {
      expect(validateApplySearch({ company: value, location: value })).toEqual({
        company: value,
        location: value,
      })
    }
  )
})
