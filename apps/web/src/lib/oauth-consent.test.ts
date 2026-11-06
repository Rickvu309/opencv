import { expect, it } from "vitest"
import {
  defaultParseSearch,
  defaultStringifySearch,
} from "@tanstack/react-router"
import { authorizationResumePath, signedConsentQuery } from "./oauth-consent.ts"

it("preserves the signed provider query including repeated parameters and encoded signatures", () => {
  const query =
    "client_id=agent&ba_param=client_id&ba_param=state&state=a%2Bb&sig=c%2Fd%3D"
  expect(signedConsentQuery(`?${query}`)).toBe(query)
  expect(signedConsentQuery(`?oauth_query=${encodeURIComponent(query)}`)).toBe(
    query
  )
})

it("wraps the exact signed query before the sign-in router serializes repeated parameters", () => {
  const query =
    "client_id=agent&ba_param=client_id&ba_param=state&state=a%2Bb&sig=c%2Fd%3D"
  const resume = new URL(
    authorizationResumePath("/oauth/connect", `?${query}`),
    "https://opencv.test"
  )
  expect(resume.pathname).toBe("/oauth/connect")
  const routedSearch = defaultStringifySearch(defaultParseSearch(resume.search))
  expect(signedConsentQuery(routedSearch)).toBe(query)
})
