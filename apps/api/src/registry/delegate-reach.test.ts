import {
  delegateActorSchema,
  personActor,
  type DelegateMarker,
  type DelegateActor,
} from "@workspace/domain/kernel"
import { operation as paperRead } from "@workspace/domain/operations/paper/read"
import { describe, expect, it } from "vitest"

import { delegateAllowed } from "./delegate-policy.js"
import { installRegistry } from "../install.js"

function delegate(
  resources: DelegateActor["resources"],
  scopes: string[]
): DelegateActor {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: "user-delegate-reach",
    connectionId: "11111111-1111-4111-8111-111111111111",
    name: "Agent",
    scopes,
    resources,
    reads: "allow",
    writes: "approval",
  })
}

const reachable = [
  "job.calendar",
  "job.get",
  "job.list",
  "job.move",
  "job.priorityCounts",
  "job.setPriority",
  "job.update",
  "paper.edit",
  "paper.read",
]

const grants = {
  "Job read": {
    actor: delegate("jobs", ["job.read"]),
    reach: ["job.calendar", "job.get", "job.list", "job.priorityCounts"],
  },
  "Job write": {
    actor: delegate("jobs", ["job.write"]),
    reach: ["job.move", "job.setPriority", "job.update"],
  },
  "Paper read": {
    actor: delegate("paper", ["paper.read"]),
    reach: ["paper.read"],
  },
  "Paper write": {
    actor: delegate("paper", ["paper.write"]),
    reach: ["paper.edit"],
  },
  "Jobs and Paper, every scope": {
    actor: delegate("jobs-and-paper", [
      "job.read",
      "job.write",
      "paper.read",
      "paper.write",
    ]),
    reach: reachable,
  },
  "Connection status only": {
    actor: delegate("none", ["connection.status"]),
    reach: [],
  },
}

const everyMarker: (DelegateMarker | undefined)[] = [
  undefined,
  "jobRead",
  "reversibleJob",
  { resource: "job", access: "read" },
  { resource: "job", access: "proposal" },
  { resource: "paper", access: "read" },
  { resource: "paper", access: "proposal" },
]

describe("what a delegate can reach", () => {
  const registry = installRegistry()
  const { commands, queries } = registry.list()
  const every = [...commands, ...queries]

  for (const [grant, { actor, reach }] of Object.entries(grants)) {
    it(`lists exactly the declared tools for a ${grant} grant`, async () => {
      expect(
        (await registry.tools(actor)).map((tool) => tool.name).sort()
      ).toEqual(reach)
    })
  }

  it("keeps every other command and read closed whatever marker it carries", () => {
    const everything = grants["Jobs and Paper, every scope"].actor
    const closed = every.filter((entry) => !reachable.includes(entry.name))
    expect(closed.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "actions.approve",
        "actions.deny",
        "activity.undo",
        "paper.start",
        "paper.update",
        "paper.duplicate",
        "paper.delete",
      ])
    )
    for (const entry of closed)
      for (const coach of [true, "auto", "confirm", "never"] as const)
        for (const marker of everyMarker)
          expect(
            delegateAllowed(
              { name: entry.name, coach, delegate: marker },
              everything
            ),
            `${entry.name} with ${JSON.stringify(marker)}`
          ).toBe(false)
  })

  it("keeps paper.start closed to agents: only the Coach and the person start a page", async () => {
    const everything = grants["Jobs and Paper, every scope"].actor
    expect(reachable).not.toContain("paper.start")
    const start = every.find((entry) => entry.name === "paper.start")
    expect(start).toBeDefined()
    expect(
      (await registry.tools(everything)).map((tool) => tool.name)
    ).not.toContain("paper.start")
  })

  it("refuses a delegate marker someone adds to Undo", () => {
    const everything = grants["Jobs and Paper, every scope"].actor
    for (const marker of everyMarker)
      expect(
        delegateAllowed(
          { name: "activity.undo", coach: "auto", delegate: marker },
          everything
        )
      ).toBe(false)
    expect(
      delegateAllowed(
        { name: "activity.undo", coach: "never" },
        personActor("user-delegate-reach")
      )
    ).toBe(true)
  })

  it("opens every paper.read view to a Paper read grant through the one paper.read check", () => {
    const views = (
      paperRead.input as unknown as {
        options: { shape: { view?: { value: string } } }[]
      }
    ).options.map((option) => option.shape.view?.value ?? "document")
    expect(views.sort()).toEqual(["document", "engine", "info", "library"])
    expect(paperRead.delegate).toEqual({ resource: "paper", access: "read" })
    for (const [grant, allowed] of [
      ["Paper read", true],
      ["Paper write", false],
      ["Job read", false],
      ["Connection status only", false],
    ] as const)
      expect(
        delegateAllowed(
          {
            name: "paper.read",
            coach: paperRead.coach,
            delegate: paperRead.delegate,
          },
          grants[grant].actor
        ),
        grant
      ).toBe(allowed)
  })

  it("names only operations the registry has", () => {
    const names = new Set(every.map((entry) => entry.name))
    for (const name of reachable) expect(names.has(name), name).toBe(true)
  })
})
