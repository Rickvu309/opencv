import { catalog } from "@workspace/domain"
import { expect } from "vitest"

import {
  flag,
  idOf,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

export function jobCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, run, undo, jobOf, gone, checklist } = tools
  const catalogCases: CoverageCase[] = [catalog["job.setPriority"]].map(
    (operation) => ({
      name: operation.name,
      arrange: async () => {
        const result = await run("job.create", {
          title: "Catalog proof",
          company: "Northwind",
        })
        ctx.jobId = idOf(result.output)
      },
      act: () =>
        run(
          operation.name,
          operation.input.parse({ jobId: ctx.jobId, priority: "high" })
        ),
      assert: async (result) => {
        expect(operation.publicResult.safeParse(result.output).success).toBe(
          true
        )
        expect(result.activityId).toBeTruthy()
        expect(await jobOf(ctx.jobId)).toMatchObject({ priority: "high" })
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(await jobOf(ctx.jobId)).toMatchObject({ priority: "normal" })
      },
    })
  )
  return [
    ...catalogCases,
    {
      name: catalog["job.create"].name,
      arrange: async () => {},
      act: () => run("job.create", { title: "Intern", company: "Northwind" }),
      assert: async (result) => {
        const job = await jobOf(idOf(result.output))
        expect(text(job, "title")).toBe("Intern")
        expect(text(job, "company")).toBe("Northwind")
      },
      undoAssert: async (result) => {
        const jobId = idOf(result.output)
        await undo(result)
        await gone(jobOf(jobId))
      },
    },
    {
      name: catalog["job.update"].name,
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "Intern", company: "Northwind" }))
            .output
        )
      },
      act: () =>
        run("job.update", {
          jobId: ctx.jobId,
          patch: {
            location: "Hanoi",
            priority: "high",
            posting: {
              about: "",
              duties: "",
              requirements: "Strong Figma skills",
              details: "",
            },
          },
        }),
      assert: async () => {
        const job = await jobOf(ctx.jobId)
        expect(text(job, "location")).toBe("Hanoi")
        expect(job).toMatchObject({
          priority: "high",
          posting: { requirements: "Strong Figma skills" },
        })
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(await jobOf(ctx.jobId)).toMatchObject({
          location: null,
          priority: "normal",
        })
      },
    },
    {
      name: "job.move",
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "Move", company: "Northwind" }))
            .output
        )
      },
      act: () => run("job.move", { jobId: ctx.jobId, stage: "applied" }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "stage")).toBe("applied")
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(text(await jobOf(ctx.jobId), "stage")).toBe("saved")
      },
    },
    {
      name: catalog["job.star"].name,
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "Star", company: "Northwind" }))
            .output
        )
      },
      act: () => run("job.star", { jobId: ctx.jobId, starred: true }),
      assert: async () => {
        expect(flag(await jobOf(ctx.jobId), "starred")).toBe(true)
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(flag(await jobOf(ctx.jobId), "starred")).toBe(false)
      },
    },
    {
      name: catalog["job.delete"].name,
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "Delete", company: "Northwind" }))
            .output
        )
      },
      act: () => run("job.delete", { jobId: ctx.jobId }),
      assert: async () => {
        await gone(jobOf(ctx.jobId))
      },
    },
    {
      name: catalog["job.addChecklistItem"].name,
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "List", company: "Northwind" }))
            .output
        )
      },
      act: () =>
        run("job.addChecklistItem", {
          jobId: ctx.jobId,
          label: "Read the posting",
        }),
      assert: async (result) => {
        const rows = await checklist(idOf(result.output))
        expect(rows.map((row) => row.label)).toEqual(["Read the posting"])
        expect(rows[0]?.done).toBe(false)
      },
      undoAssert: async (result) => {
        const itemId = idOf(result.output)
        await undo(result)
        expect(await checklist(itemId)).toEqual([])
      },
    },
    {
      name: catalog["job.setChecklistItem"].name,
      arrange: async () => {
        const job = await run("job.create", {
          title: "Check",
          company: "Northwind",
        })
        const item = await run("job.addChecklistItem", {
          jobId: idOf(job.output),
          label: "Read the posting",
        })
        ctx.jobId = idOf(job.output)
        ctx.itemId = idOf(item.output)
      },
      act: () =>
        run("job.setChecklistItem", {
          jobId: ctx.jobId,
          itemId: ctx.itemId,
          done: true,
        }),
      assert: async () => {
        expect((await checklist(ctx.itemId))[0]?.done).toBe(true)
      },
      undoAssert: async (result) => {
        await undo(result)
        expect((await checklist(ctx.itemId))[0]?.done).toBe(false)
      },
    },
    {
      name: catalog["job.removeChecklistItem"].name,
      arrange: async () => {
        const job = await run("job.create", {
          title: "Remove",
          company: "Northwind",
        })
        const item = await run("job.addChecklistItem", {
          jobId: idOf(job.output),
          label: "Read the posting",
        })
        ctx.jobId = idOf(job.output)
        ctx.itemId = idOf(item.output)
      },
      act: () =>
        run("job.removeChecklistItem", {
          jobId: ctx.jobId,
          itemId: ctx.itemId,
        }),
      assert: async () => {
        expect(await checklist(ctx.itemId)).toEqual([])
      },
    },
    {
      name: catalog["job.addNote"].name,
      arrange: async () => {
        ctx.jobId = idOf(
          (await run("job.create", { title: "Note", company: "Northwind" }))
            .output
        )
      },
      act: () => run("job.addNote", { jobId: ctx.jobId, body: "" }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "note")).toBe("")
      },
    },
    {
      name: catalog["job.linkPaper"].name,
      arrange: async () => {
        const job = await run("job.create", {
          title: "Link",
          company: "Northwind",
        })
        const first = await run("paper.create", {
          kind: "cv",
          name: "First CV",
        })
        const second = await run("paper.create", {
          kind: "cv",
          name: "Second CV",
        })
        ctx.jobId = idOf(job.output)
        ctx.docId = idOf(first.output)
        ctx.otherDocId = idOf(second.output)
        await run("job.linkPaper", {
          jobId: ctx.jobId,
          docId: ctx.docId,
          kind: "cv",
        })
      },
      act: () =>
        run("job.linkPaper", {
          jobId: ctx.jobId,
          docId: ctx.otherDocId,
          kind: "cv",
        }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "cvDocId")).toBe(ctx.otherDocId)
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(text(await jobOf(ctx.jobId), "cvDocId")).toBe(ctx.docId)
        await run("job.unlinkPaper", { jobId: ctx.jobId, kind: "cv" })
        const fresh = await run("job.linkPaper", {
          jobId: ctx.jobId,
          docId: ctx.otherDocId,
          kind: "cv",
        })
        await undo(fresh)
        expect(text(await jobOf(ctx.jobId), "cvDocId")).toBeNull()
      },
    },
    {
      name: catalog["job.unlinkPaper"].name,
      arrange: async () => {
        const job = await run("job.create", {
          title: "Unlink",
          company: "Northwind",
        })
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Unlink CV",
        })
        ctx.jobId = idOf(job.output)
        ctx.docId = idOf(paper.output)
        await run("job.linkPaper", {
          jobId: ctx.jobId,
          docId: ctx.docId,
          kind: "cv",
        })
      },
      act: () => run("job.unlinkPaper", { jobId: ctx.jobId, kind: "cv" }),
      assert: async () => {
        expect(text(await jobOf(ctx.jobId), "cvDocId")).toBeNull()
      },
    },
  ]
}
