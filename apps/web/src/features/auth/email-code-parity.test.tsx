import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EmailCodeScreen } from "./email-code-screen.tsx"
import entry from "./design/email-code.snapshot.json"
import verifying from "./design/email-code-verifying.snapshot.json"
import error from "./design/email-code-error.snapshot.json"

afterEach(cleanup)
const props = {
  email: "linh.nguyen@gmail.com",
  code: "481",
  state: "code",
  invalid: false,
  notice: null,
  inbox: "https://mail.google.com/",
  seconds: 42,
  sending: false,
  showResend: false,
  focusNonce: 0,
  onChange: vi.fn(),
  onComplete: vi.fn(),
  onResend: vi.fn(),
  onChangeEmail: vi.fn(),
  onBack: vi.fn(),
} satisfies Parameters<typeof EmailCodeScreen>[0]

function formTexts(snapshot: typeof entry) {
  const texts = snapshot.sections.find(
    (section) => section.name === "Left"
  )?.texts
  if (!texts) throw new Error("Pen frame lacks its left pane")
  return texts.slice(3, -1).filter((text) => !/^\d$/.test(text))
}

function expectTexts(texts: string[]) {
  for (const text of texts) expect(screen.getByText(text)).toBeInTheDocument()
}

describe("email code pen frames", () => {
  it("shows the entry frame copy, partial digits and open-email destination", () => {
    render(<EmailCodeScreen {...props} />)
    expectTexts(formTexts(entry))
    expect(screen.getByRole("link", { name: "Open email" })).toHaveAttribute(
      "href",
      props.inbox
    )
    expect(
      screen.getAllByRole("textbox").map((input) => input.getAttribute("value"))
    ).toEqual(["4", "8", "1", "", "", ""])
    for (const input of screen.getAllByRole("textbox"))
      expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("shows the verifying frame and locks all digits until verification returns", () => {
    render(<EmailCodeScreen {...props} state="verifying" code="481902" />)
    expectTexts(formTexts(verifying))
    expect(screen.getByRole("status")).toHaveTextContent("Verifying…")
    for (const input of screen.getAllByRole("textbox"))
      expect(input).toBeDisabled()
    expect(
      screen.queryByRole("link", { name: "Open email" })
    ).not.toBeInTheDocument()
  })

  it("shows the rejected frame, invalid digits and a working resend action", () => {
    const notice = error.sections
      .flatMap((section) => section.texts)
      .find((text) => text.startsWith("That code"))
    if (!notice) throw new Error("Pen error frame lacks its rejection copy")
    render(
      <EmailCodeScreen
        {...props}
        code="481902"
        invalid
        notice={notice}
        showResend
      />
    )
    expectTexts(formTexts(error))
    expect(screen.getByRole("alert")).toHaveTextContent(notice)
    for (const input of screen.getAllByRole("textbox")) {
      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(input).toHaveAccessibleDescription(notice)
    }
    screen.getByRole("button", { name: "Send a new code" }).click()
    expect(props.onResend).toHaveBeenCalledOnce()
  })
})
