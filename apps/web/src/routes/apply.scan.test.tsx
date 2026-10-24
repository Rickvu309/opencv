import { describe, expect, it } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { APPLY_SCAN_FETCH_FAILED } from "@workspace/domain"
import {
  installApplyTestLifecycle,
  renderApply,
  expectApplyLive,
  addJobFromDialog,
} from "@/test/apply-route-fixtures.ts"

installApplyTestLifecycle()

describe("Apply posting scan", () => {
  it("scans pasted JD and opens an editable drawer", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.change(within(dialog).getByLabelText("Posting text"), {
      target: {
        value:
          "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September.",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Associate PM intern at Local startup."
      )
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add opportunity" })
    )
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Hanoi")).toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText("Title"), {
      target: { value: "Associate PM intern (edited)" },
    })
    fireEvent.blur(within(panel).getByLabelText("Title"))
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Associate PM intern \(edited\) at Local startup/,
        })
      ).toBeInTheDocument()
    })
  })

  it("scans a posting URL and autofills the drawer", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.change(within(dialog).getByLabelText("Posting link"), {
      target: { value: "careers.example.com/pm-intern" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText("Filled PM intern at Example.")
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add opportunity" })
    )
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(within(panel).getByDisplayValue("PM intern")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Example")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue("https://careers.example.com/pm-intern")
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Scan posting" })
    ).toBeEnabled()
  })

  it("scans the same labeled JD twice without a false Couldn't find", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    const jd = within(dialog).getByLabelText("Posting text")
    const cafeJd = [
      "Job Title: Café Barista Lead",
      "Company: Highlands Coffee",
      "Location: District 1, Ho Chi Minh City",
      "We need a café lead who owns the morning rush and trains new baristas.",
    ].join("\n")

    fireEvent.change(jd, { target: { value: cafeJd } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Café Barista Lead at Highlands Coffee."
      )
    ).toBeInTheDocument()

    fireEvent.change(jd, { target: { value: `${cafeJd} ` } })
    fireEvent.change(jd, { target: { value: cafeJd } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Café Barista Lead at Highlands Coffee."
      )
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("honest-fails a dead posting URL instead of leaving a filled Untitled role", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.change(within(dialog).getByLabelText("Posting link"), {
      target: {
        value: "jobs.careers.microsoft.com/global/en/job/missing",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      APPLY_SCAN_FETCH_FAILED
    )
    expect(within(dialog).queryByText(/^Filled /)).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText("Posting link")).toHaveValue(
      "jobs.careers.microsoft.com/global/en/job/missing"
    )

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add opportunity" })
    )
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Company")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "https://jobs.careers.microsoft.com/global/en/job/missing"
      )
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText("Notes")).toHaveValue("")
    expect(within(panel).queryByDisplayValue(/Page not found/i)).toBeNull()
  })

  it("fills pasted hiring prose in Add opportunity after an unread URL fail", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.change(within(dialog).getByLabelText("Posting link"), {
      target: {
        value: "jobs.careers.microsoft.com/global/en/job/missing",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      APPLY_SCAN_FETCH_FAILED
    )

    fireEvent.change(within(dialog).getByLabelText("Posting text"), {
      target: {
        value:
          "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September.",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Associate PM intern at Local startup."
      )
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText("Posting link")).toHaveValue(
      "jobs.careers.microsoft.com/global/en/job/missing"
    )
  })

  it("keeps the URL on a failed drawer scan and fills after pasted JD", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog("jobs.careers.microsoft.com/global/en/job/missing")
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Scan posting" }))
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      APPLY_SCAN_FETCH_FAILED
    )
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Company")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "https://jobs.careers.microsoft.com/global/en/job/missing"
      )
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText("Notes")).toHaveValue("")

    fireEvent.change(within(panel).getByLabelText("Posting text"), {
      target: {
        value:
          "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September.",
      },
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Scan posting" }))
    await waitFor(() => {
      expect(
        within(panel).getByDisplayValue("Associate PM intern")
      ).toBeInTheDocument()
    })
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "https://jobs.careers.microsoft.com/global/en/job/missing"
      )
    ).toBeInTheDocument()
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("honest-fails scan when the post has no title or company", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.change(within(dialog).getByLabelText("Posting text"), {
      target: { value: "Come work with us. Nice people." },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't find a title or company in that post."
    )
    expect(
      screen.queryByRole("complementary", { name: "Opportunity detail" })
    ).not.toBeInTheDocument()
  })
})
