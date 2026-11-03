import path from "node:path"
import { afterEach, expect, it, vi } from "vitest"

import { applyLocalApiUrl } from "../local-env"

const loadEnv = vi.hoisted(() => vi.fn())

vi.mock("vite", () => ({ loadEnv }))

const savedApiUrl = process.env.VITE_API_URL

afterEach(() => {
  loadEnv.mockReset()
  if (savedApiUrl === undefined) delete process.env.VITE_API_URL
  else process.env.VITE_API_URL = savedApiUrl
})

it("reads the repo root env, and an explicit VITE_API_URL wins over the url derived from PORT so a Railway build stays unchanged", () => {
  loadEnv.mockReturnValue({
    PORT: "4000",
    VITE_API_URL: "https://api.example.test",
  })
  const urls = applyLocalApiUrl("development")
  expect(loadEnv).toHaveBeenCalledWith(
    "development",
    path.resolve(__dirname, "../../.."),
    ""
  )
  expect(urls.apiUrl).toBe("http://localhost:4000")
  expect(process.env.VITE_API_URL).toBe("https://api.example.test")
})

it("derives VITE_API_URL from PORT when none is set", () => {
  loadEnv.mockReturnValue({ PORT: "4000" })
  applyLocalApiUrl("development")
  expect(process.env.VITE_API_URL).toBe("http://localhost:4000")
})
