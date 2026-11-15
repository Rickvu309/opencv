import { NATIVE_WRITER } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"

import { getDb } from "../db/context.js"
import { coachTasks } from "../db/schema.js"
import type { ModelStep } from "./model-step.js"
import { createTaskRuntime } from "./task-runtime.js"
import { fixture } from "./worker-fixture.js"

it("keeps the native basis through the fake worker context and proposed edit", async () => {
  await fixture(async ({ taskId }, registry) => {
    const nativeBasis = {
      provenance: {
        documentVersion: 4,
        schemaRevision: 1,
        writerProtocol: 1,
        requiredCapabilities: ["structured-prose", "underline"],
      },
      epoch: 2,
      revision: 3,
      digest: "a".repeat(64),
    }
    const [task] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, taskId))
    if (!task) throw new Error("Missing task")
    const runtime = createTaskRuntime(
      {
        ...task,
        contextSnapshot: {
          messages: [],
          focusDoc: {
            id: "00000000-0000-7000-8000-000000001518",
            revision: 3,
            outline: "Letter\n[p1] Dear team",
            nativeBasis,
          },
        },
      },
      registry
    )
    const steps: ModelStep[] = []
    for await (const _part of runtime({
      messages: [],
      completedSteps: 0,
      signal: new AbortController().signal,
      maxSteps: 10,
      maxTokens: 1000,
      boundary: {
        persistStep: async (step) => {
          steps.push(step)
        },
        runIntent: async () => "{}",
      },
    })) {
    }
    expect(steps[0]?.intents[0]).toMatchObject({
      name: "paper.edit",
      input: {
        docId: "00000000-0000-7000-8000-000000001518",
        writer: NATIVE_WRITER,
        nativeBasis,
      },
    })
  })
})
