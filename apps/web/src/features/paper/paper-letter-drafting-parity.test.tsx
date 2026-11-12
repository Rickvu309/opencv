import type { JobView } from "@workspace/domain"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { render } from "@/test/render-with-client.tsx"

import layout from "./design/letter-drafting.layout.json"
import { PaperLetterDraftingPage } from "./paper-letter-drafting-page.tsx"
import { PaperLetterStartPage } from "./paper-letter-start-page.tsx"

const job: JobView = {
  id: "job-1",
  title: "Junior Marketing",
  company: "Lumière",
  posting: {},
  cvDocId: null,
  letterDocId: null,
  updatedAt: "2026-08-25T12:00:00.000Z",
}

const { listJobs } = vi.hoisted(() => ({ listJobs: vi.fn() }))
vi.mock("@/features/apply/apply-api.ts", () => ({ listJobs }))

afterEach(cleanup)

it("shows pen-frame static texts in the drafting screen", () => {
  const staticTexts = layout.texts
    .map((t) => t.text)
    .filter((t) => ["Drafting", "Stop", "Coach is writing…"].includes(t))
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter, Lumière"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  for (const text of staticTexts) {
    expect(screen.getByText(text)).toBeInTheDocument()
  }
  expect(screen.getByRole("button", { name: "Paper" })).toBeInTheDocument()
  expect(screen.getByText("Cover letters")).toBeInTheDocument()
  expect(screen.getByText("Cover letter, Lumière")).toBeInTheDocument()
})

it("shows attribution from attached file when provided", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution="From role-description.pdf"
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.getByText("From role-description.pdf")).toBeInTheDocument()
})

it("does not show attribution when none is provided", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.queryByText(/^From /)).not.toBeInTheDocument()
})

it("shows streamed text in the card", () => {
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText="Dear hiring team,"
      onStop={() => undefined}
      onBack={() => undefined}
    />
  )
  expect(screen.getByText("Dear hiring team,")).toBeInTheDocument()
})

it("calls onStop when Stop is clicked", () => {
  const onStop = vi.fn()
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={onStop}
      onBack={() => undefined}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  expect(onStop).toHaveBeenCalledOnce()
})

it("calls onBack when Paper breadcrumb is clicked", () => {
  const onBack = vi.fn()
  render(
    <PaperLetterDraftingPage
      draftName="Cover letter"
      attribution={null}
      streamedText=""
      onStop={() => undefined}
      onBack={onBack}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Paper" }))
  expect(onBack).toHaveBeenCalledOnce()
})

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function fail(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function installFetch(
  mode: "stream" | "stop" | "partial" | "error" | "notice" | "late" | "long"
) {
  const minted = {
    generation: "package",
    docId: "letter-1",
    revision: "22222222-2222-4222-8222-222222222222",
    name: "Cover letter, Lumière.docx",
    kind: "letter",
  }
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/commands/paper.canvas"))
      return Promise.resolve(ok(minted))
    if (url.includes("/api/commands/chat.create"))
      return Promise.resolve(ok({ id: "chat-1" }))
    if (url.includes("/stop")) return Promise.resolve(ok({}))
    if (url.includes("/turns")) {
      if (mode === "error") {
        return Promise.resolve(
          fail(500, "SERVER_ERROR", "Something went wrong.")
        )
      }
      if (mode === "stop") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          })
        })
      }
      if (mode === "notice" || mode === "long") {
        const draft =
          mode === "long"
            ? Array.from(
                { length: 101 },
                (_, index) => `Paragraph ${index + 1}.`
              ).join("\n\n")
            : "Dear hiring team,\n\nI ran the spring campaign."
        const frames = [
          `event: text-delta\ndata: ${JSON.stringify({ text: draft })}\n\n`,
          ...(mode === "notice"
            ? [
                `event: notice\ndata: ${JSON.stringify({ text: "Coach is still working. Reload this Chat to follow or stop it." })}\n\n`,
              ]
            : []),
          `event: message-end\ndata: ${JSON.stringify({ chatId: "chat-1" })}\n\n`,
        ]
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frames.join("")))
            controller.close()
          },
        })
        return Promise.resolve(
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          })
        )
      }
      if (mode === "late") {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'event: text-delta\ndata: {"text":"Dear hiring team,"}\n\n'
              )
            )
            init?.signal?.addEventListener("abort", () => {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: text-delta\ndata: {"text":"\\n\\nWritten after Stop."}\n\n'
                )
              )
              controller.error(new DOMException("Stopped", "AbortError"))
            })
          },
        })
        return Promise.resolve(
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          })
        )
      }
      if (mode === "partial") {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'event: text-delta\ndata: {"text":"Dear hiring team,"}\n\n'
              )
            )
            init?.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("Stopped", "AbortError"))
            )
          },
        })
        return Promise.resolve(
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          })
        )
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              [
                'event: text-delta\ndata: {"text":"Dear hiring team,"}\n\n',
                'event: text-delta\ndata: {"text":"\\n\\nI ran the spring campaign."}\n\n',
              ].join("")
            )
          )
          controller.close()
        },
      })
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    }
    return Promise.resolve(ok({}))
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

it("shows the drafting overlay when a draft starts", async () => {
  installFetch("stop")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  expect(await screen.findByText("Coach is writing…")).toBeInTheDocument()
  expect(screen.getByText("Drafting")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
})

it("calls onCreated after stream completes and removes the overlay", async () => {
  installFetch("stream")
  listJobs.mockResolvedValue([job])
  const onCreated = vi.fn()
  render(
    <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
})

it("stops the draft from the drafting overlay Stop button", async () => {
  installFetch("stop")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  const stopBtn = await screen.findByRole("button", { name: "Stop" })
  fireEvent.click(stopBtn)
  await vi.waitFor(() =>
    expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
  )
  expect(
    screen.getByRole("heading", { name: "Start a cover letter" })
  ).toBeInTheDocument()
})

it("returns form after a draft error and shows the error message", async () => {
  installFetch("error")
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage
      onBack={() => undefined}
      onCreated={() => undefined}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await screen.findByText("Coach is writing…")
  await vi.waitFor(() =>
    expect(screen.queryByText("Coach is writing…")).not.toBeInTheDocument()
  )
  expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
})

it("saves the visible partial letter when Stop aborts its stream", async () => {
  const fetch = installFetch("partial")
  listJobs.mockResolvedValue([job])
  const onCreated = vi.fn()
  render(
    <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await screen.findByText("Dear hiring team,")
  expect(screen.getByRole("button", { name: "Stop" })).toHaveFocus()
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  const saves = fetch.mock.calls.filter(([url]) =>
    String(url).includes("/commands/paper.")
  )
  expect(saves.map(([url]) => String(url))).toEqual([
    expect.stringContaining("/commands/paper.canvas"),
  ])
  expect(JSON.parse(String(saves[0]?.[1]?.body))).toMatchObject({
    input: {
      op: "mint",
      label: "letter",
      name: "Cover letter, Lumière",
      jobId: job.id,
      lines: ["Dear hiring team,"],
    },
  })
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/stop"))).toBe(
    true
  )
})

it("cancels on leaving without saving or reopening the letter", async () => {
  const fetch = installFetch("partial")
  listJobs.mockResolvedValue([job])
  const onCreated = vi.fn()
  const view = render(
    <PaperLetterStartPage onBack={() => view.unmount()} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await screen.findByText("Dear hiring team,")
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Paper" }))
  )
  expect(onCreated).not.toHaveBeenCalled()
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/stop"))).toBe(
    true
  )
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes("/commands/paper."))
  ).toBe(false)
})

it("opens one Word page with every drafted paragraph and no older letter", async () => {
  const fetch = installFetch("stream")
  listJobs.mockResolvedValue([job])
  const onCreated = vi.fn()
  render(
    <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  const commands = fetch.mock.calls
    .map(([url, init]) => ({ url: String(url), init }))
    .filter(({ url }) => url.includes("/commands/paper."))
  expect(commands.map(({ url }) => url.split("/commands/")[1])).toEqual([
    "paper.canvas",
  ])
  expect(JSON.parse(String(commands[0]?.init?.body))).toMatchObject({
    input: {
      op: "mint",
      label: "letter",
      jobId: job.id,
      lines: ["Dear hiring team,", "I ran the spring campaign."],
    },
  })
  const turn = fetch.mock.calls.find(([url]) => String(url).includes("/turns"))
  expect(JSON.parse(String(turn?.[1]?.body))).not.toHaveProperty("focusDocId")
})

function mintInputs(fetch: ReturnType<typeof installFetch>) {
  return fetch.mock.calls
    .filter(([url]) => String(url).includes("/commands/paper."))
    .map(([url, init]) => ({
      command: String(url).split("/commands/")[1],
      input: JSON.parse(String(init?.body)).input,
    }))
}

async function draftForJob(onCreated: () => void) {
  listJobs.mockResolvedValue([job])
  render(
    <PaperLetterStartPage onBack={() => undefined} onCreated={onCreated} />
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Junior Marketing, Lumière" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Draft letter" }))
}

it("keeps the still-working notice out of a draft that crosses 30 seconds", async () => {
  const fetch = installFetch("notice")
  const onCreated = vi.fn()
  await draftForJob(onCreated)
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  expect(mintInputs(fetch)).toEqual([
    {
      command: "paper.canvas",
      input: expect.objectContaining({
        lines: ["Dear hiring team,", "I ran the spring campaign."],
      }),
    },
  ])
  expect(screen.queryByText(/still working/)).toBeNull()
})

it("saves nothing the Coach sends after the person clicks Stop", async () => {
  const fetch = installFetch("late")
  const onCreated = vi.fn()
  await draftForJob(onCreated)
  await screen.findByText("Dear hiring team,")
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("letter-1"))
  expect(mintInputs(fetch)).toEqual([
    {
      command: "paper.canvas",
      input: expect.objectContaining({ lines: ["Dear hiring team,"] }),
    },
  ])
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/stop"))).toBe(
    true
  )
})

it("refuses a letter too long for one Word page save and makes no page", async () => {
  const fetch = installFetch("long")
  const onCreated = vi.fn()
  await draftForJob(onCreated)
  expect(
    await screen.findByText(
      "This letter is too long to save. Shorten it and try again."
    )
  ).toBeInTheDocument()
  expect(onCreated).not.toHaveBeenCalled()
  expect(mintInputs(fetch)).toEqual([])
})
