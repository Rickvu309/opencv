import { describe, expect, it } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import {
  STARTER_CV_NAME,
  STARTER_GUIDED_APPLY_COMPANY,
  starterCvDocument,
} from "@workspace/domain"
import {
  PAPER_ATTACH_SAMPLE_CTA,
  PAPER_LINKED_EMPTY_HINT,
  PAPER_ZERO_STATES,
  SAMPLE_CV_LABEL,
  SAMPLE_CV_MAKE_MINE,
  ownedCvName,
} from "@/features/paper/paper-data.ts"
import { TEST_SESSION_USER } from "@/test/auth-client-mock.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  queryByAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  ownedSampleCvName,
  seedSampleInternshipCv,
  seedStarterPaperDrive,
  sampleInternshipCv,
  stubDesktopViewport,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper drive", () => {
  it("lists documents with status and filters by search", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(screen.getAllByRole("row")).toHaveLength(
      getMockPaperDocs().length + 1
    )
    expect(
      screen.getByRole("columnheader", { name: "Type" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()

    const search = screen.getByRole("textbox", { name: "Search Paper" })
    fireEvent.change(search, { target: { value: "cover" } })

    const filtered = screen.getByRole("table")
    expect(
      within(filtered).getByText("Cover: Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(filtered).getByText("Cover: Product intern")
    ).toBeInTheDocument()
    expect(within(filtered).queryByText("PM track CV")).not.toBeInTheDocument()
    expect(
      within(filtered).queryByText("Checkout card resize study")
    ).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: "zzzz-no-doc" } })
    expect(
      within(screen.getByRole("main")).queryByText("Cover: Associate PM intern")
    ).not.toBeInTheDocument()
  })

  it("opens the sample CV from the Home first-café deep-link", async () => {
    seedSampleInternshipCv()
    renderApp(`${SURFACE_PATHS.paper}?open=sample`)

    expect(
      await screen.findByRole("region", {
        name: `Editing ${STARTER_CV_NAME}`,
      })
    ).toBeInTheDocument()
    expect(screen.getByText(new RegExp(SAMPLE_CV_LABEL))).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: SAMPLE_CV_MAKE_MINE })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New" })
    ).not.toBeInTheDocument()
  })

  it("labels the sample CV and offers quiet empty-list CTAs on desktop", async () => {
    stubDesktopViewport(true)
    seedStarterPaperDrive()
    renderPaper()

    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()
    expect(await screen.findByText(STARTER_CV_NAME)).toBeInTheDocument()
    expect(screen.getAllByText(SAMPLE_CV_LABEL).length).toBeGreaterThanOrEqual(
      1
    )

    expect(
      screen.getByRole("button", { name: PAPER_ZERO_STATES.letter.title })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: PAPER_ZERO_STATES.proof.title })
    ).toBeInTheDocument()
    const linked = screen.getByRole("button", { name: PAPER_ATTACH_SAMPLE_CTA })
    expect(linked).toHaveAccessibleDescription(PAPER_LINKED_EMPTY_HINT)

    expect(screen.queryByText("None yet")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/unlock your|get started|welcome to your/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/no letters yet/i)).not.toBeInTheDocument()
    expect(queryByAttr(document, "data-slot='empty-title'")).toBeNull()
    expect(queryByAttr(document, "data-slot='empty-icon'")).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: PAPER_ZERO_STATES.letter.title })
    )
    expect(
      await screen.findByRole("region", { name: "Editing Untitled Letter" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back to Paper/i }))
    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: PAPER_ZERO_STATES.letter.title })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: PAPER_ZERO_STATES.proof.title })
    )
    expect(
      await screen.findByRole("region", { name: "Editing Untitled Proof" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back to Paper/i }))
    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: PAPER_ATTACH_SAMPLE_CTA })
    )
    expect(
      screen.queryByRole("dialog", { name: "Link to Apply" })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(STARTER_GUIDED_APPLY_COMPANY)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: PAPER_ATTACH_SAMPLE_CTA })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: `Actions for ${STARTER_CV_NAME}`,
      })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Clear sample" })
    )
    const confirm = await screen.findByRole("dialog", { name: "Clear sample" })
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }))
    await waitFor(() => {
      expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    })
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
  })

  it("makes the sample CV theirs from the drive without a wipe wizard", async () => {
    stubDesktopViewport(true)
    seedStarterPaperDrive()
    renderPaper()

    expect(await screen.findByText(STARTER_CV_NAME)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", {
        name: `Actions for ${STARTER_CV_NAME}`,
      })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: SAMPLE_CV_MAKE_MINE })
    )

    expect(await screen.findByText(ownedSampleCvName())).toBeInTheDocument()
    expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: /clear|wipe|reset|confirm/i })
    ).not.toBeInTheDocument()
    expect(sampleInternshipCv().name).toBe(ownedSampleCvName())
    expect(sampleInternshipCv().content).toEqual(starterCvDocument())
  })

  it("makes the sample CV theirs from editor chrome after a real edit", async () => {
    stubDesktopViewport(true)
    seedStarterPaperDrive()
    renderPaper()
    const editor = await openDoc(STARTER_CV_NAME)

    expect(
      screen.getByRole("button", { name: SAMPLE_CV_MAKE_MINE })
    ).toBeInTheDocument()
    expect(
      within(editor).getByText(new RegExp(SAMPLE_CV_LABEL))
    ).toBeInTheDocument()

    const name = within(editor).getByRole("textbox", { name: "Your name" })
    name.textContent = "Linh Nguyen"
    fireEvent.input(name)

    await waitFor(() => {
      expect(sampleInternshipCv().content.name).toBe("Linh Nguyen")
      expect(sampleInternshipCv().name).toBe(
        ownedCvName(TEST_SESSION_USER.name, "Linh Nguyen")
      )
    })
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: SAMPLE_CV_MAKE_MINE })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: /clear|wipe|reset|confirm/i })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back to Paper/i }))
    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("main")).getByText("Linh's CV")
    ).toBeInTheDocument()
    expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
  })

  it("claims the sample CV with Make mine and keeps edits across reload", async () => {
    stubDesktopViewport(true)
    seedStarterPaperDrive()
    const first = renderPaper()
    const editor = await openDoc(STARTER_CV_NAME)

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    summary.textContent = "Café rewrite I want to keep"
    fireEvent.input(summary)
    fireEvent.click(screen.getByRole("button", { name: SAMPLE_CV_MAKE_MINE }))

    await waitFor(() => {
      expect(sampleInternshipCv().name).toBe(ownedSampleCvName())
      expect(sampleInternshipCv().content.summary).toBe(
        "Café rewrite I want to keep"
      )
    })

    first.unmount()
    cleanup()
    renderPaper()
    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()
    expect(await screen.findByText(ownedSampleCvName())).toBeInTheDocument()
    expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
    const reloaded = await openDoc(ownedSampleCvName())
    expect(
      within(reloaded).getByText("Café rewrite I want to keep")
    ).toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: SAMPLE_CV_MAKE_MINE })
    ).not.toBeInTheDocument()
  })

  it("attaches the sample CV from Paper and shows the link on Apply", async () => {
    stubDesktopViewport(true)
    seedStarterPaperDrive()
    renderPaper()

    expect(
      await screen.findByRole("region", { name: "Paper" })
    ).toBeInTheDocument()
    expect(await screen.findByText(STARTER_CV_NAME)).toBeInTheDocument()
    const linked = screen.getByRole("button", { name: PAPER_ATTACH_SAMPLE_CTA })
    expect(linked).toHaveAccessibleDescription(PAPER_LINKED_EMPTY_HINT)
    fireEvent.click(linked)

    await waitFor(() => {
      expect(
        getMockPaperDocs().find((doc) => doc.name === STARTER_CV_NAME)
          ?.applyCardId
      ).toBe("01900000-0000-7000-8000-000000000001")
    })
    expect(
      screen.queryByRole("dialog", { name: "Link to Apply" })
    ).not.toBeInTheDocument()
    expect(screen.getByText(STARTER_GUIDED_APPLY_COMPANY)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: /^Apply/ }))
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
  })

  it("shows and changes the Apply card link", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(screen.getByText("Local startup")).toBeInTheDocument()
    expect(screen.getByText("Fintech scale-up")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Actions for Cover: Associate PM intern",
      })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Change Apply link" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Link to Apply" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }))

    await waitFor(() => {
      expect(screen.queryByText("Local startup")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Fintech scale-up")).toBeInTheDocument()
  })

  it("keeps New enabled and offers no Filter", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(
      screen.queryByRole("button", { name: /filter/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toBeEnabled()
  })

  it("creates, renames, changes status, and deletes a document", async () => {
    renderPaper()
    await expectPaperDrive()

    fireEvent.click(screen.getByRole("button", { name: "New" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Letter" }))

    expect(
      await screen.findByRole("region", { name: "Editing Untitled Letter" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back to Paper/i }))
    await expectPaperDrive()
    expect(
      within(screen.getByRole("main")).getByText("Untitled Letter")
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Actions for Untitled Letter",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }))
    const nameInput = await screen.findByRole("textbox", {
      name: "Name",
    })
    fireEvent.change(nameInput, { target: { value: "Cover: intern" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await within(screen.getByRole("main")).findByText("Cover: intern")
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Cover: intern" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Mark as Ready" })
    )
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Actions for Cover: intern" })
          .closest("tr")
      ).toHaveTextContent("Ready")
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Cover: intern" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirm = await screen.findByRole("dialog", {
      name: "Delete",
    })
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByRole("dialog", { name: "Delete" })
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("main")).getByText("Cover: intern")
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Cover: intern" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete",
    })
    fireEvent.click(
      within(confirmAgain).getByRole("button", { name: "Delete" })
    )
    await waitFor(() => {
      expect(screen.queryByText("Cover: intern")).not.toBeInTheDocument()
    })
    await expectPaperDrive()
  })

  it("rolls content edits back and shows the real error message", async () => {
    const { failNextPaperCommand } = await import("@/test/paper-api-mock.ts")
    const { PAPER_COMMANDS } = await import("@workspace/domain")
    failNextPaperCommand(
      PAPER_COMMANDS.updateContent,
      "Headline must be a string"
    )

    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    const summary = screen.getByRole("textbox", { name: "Summary" })
    summary.textContent = "Edited summary that should roll back"
    fireEvent.input(summary)

    expect(
      await screen.findByRole("alert", {}, { timeout: 2000 })
    ).toHaveTextContent("Headline must be a string")
    await waitFor(() => {
      expect(summary).not.toHaveTextContent(
        "Edited summary that should roll back"
      )
    })
  })

  it("opens a document and returns to the drive", async () => {
    renderPaper()
    await expectPaperDrive()

    await openDoc("PM track CV")
    expect(
      screen.getByRole("button", { name: /back to Paper/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Paper" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /back to Paper/i }))
    await expectPaperDrive()
  })
})
