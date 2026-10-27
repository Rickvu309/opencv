import { afterEach, describe, expect, it, vi } from "vitest"

import { authMockState } from "@/test/auth-client-mock.ts"

import {
  ApiError,
  apiBaseUrl,
  apiFetch,
  apiStream,
  fetchHealth,
  resetUnauthorizedHandler,
  setSessionExpiredListener,
  setUnauthorizedHandler,
} from "./api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
  resetUnauthorizedHandler()
})

describe("fetchHealth", () => {
  it("calls GET /health on the configured API host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchHealth()).resolves.toEqual({ ok: true })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/health`)
  })

  it("rejects when the health endpoint is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )

    await expect(fetchHealth()).rejects.toThrow("Failed to fetch")
  })

  it("rejects when health responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 502 }))
    )

    await expect(fetchHealth()).rejects.toThrow("Health check failed with 502")
  })
})

describe("apiFetch", () => {
  it("sends credentials and returns JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, chats: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(apiFetch("/api/chats")).resolves.toEqual({
      ok: true,
      chats: [],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/chats`)
    expect(init.credentials).toBe("include")
  })

  it("maps the error envelope to a typed ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "NOT_FOUND", message: "Thread missing" },
          },
          { status: 404 }
        )
      )
    )

    const error = await apiFetch("/api/chats/missing").catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Thread missing",
    })
  })

  it("invalidates the session and runs the unauthorized handler", async () => {
    const onUnauthorized = vi.fn(() => {
      authMockState.data = null
    })
    setUnauthorizedHandler(onUnauthorized)

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 }
        )
      )
    )

    await expect(apiFetch("/api/session")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(authMockState.data).toBeNull()
  })
})

describe("apiStream", () => {
  it("sends credentials and returns the streaming body", async () => {
    const body = 'event: message-start\ndata: {"chatId":"t1"}\n\n'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const res = await apiStream("/api/chats/t1/turns", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    })

    expect(await res.text()).toBe(body)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/chats/t1/turns`
    )
    expect(init.credentials).toBe("include")
    expect(init.method).toBe("POST")
  })

  it("maps a pre-stream error envelope to ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: {
              code: "COACH_UNAVAILABLE",
              message: "The Coach is unavailable right now",
            },
          },
          { status: 503 }
        )
      )
    )

    const error = await apiStream("/api/chats/t1/turns", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    }).catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 503,
      code: "COACH_UNAVAILABLE",
    })
  })

  it("invalidates the session on 401", async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "UNAUTHORIZED", message: "Authentication required" },
          },
          { status: 401 }
        )
      )
    )

    await expect(
      apiStream("/api/chats/t1/turns", { method: "POST" })
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it("assigns sign-in when nothing is listening", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", {
      pathname: "/app",
      search: "",
      origin: "http://localhost:3000",
      href: "http://localhost:3000/app",
      assign,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 }
        )
      )
    )
    await expect(apiFetch("/api/session")).rejects.toMatchObject({
      status: 401,
    })
    expect(assign).toHaveBeenCalled()
    expect(String(assign.mock.calls[0]?.[0])).toContain("/sign-in")
  })

  it("skips navigation when a session-expired listener is registered", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", {
      pathname: "/app",
      search: "",
      origin: "http://localhost:3000",
      href: "http://localhost:3000/app",
      assign,
    })
    const listener = vi.fn()
    setSessionExpiredListener(listener)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 }
        )
      )
    )
    await expect(apiFetch("/api/session")).rejects.toMatchObject({
      status: 401,
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(assign).not.toHaveBeenCalled()
  })
})
