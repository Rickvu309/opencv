import fc from "fast-check"
import { afterAll, beforeAll, describe, it } from "vitest"

import {
  commands,
  reset,
  RUNS,
  SEED,
  startPhotoLifetime,
  stopPhotoLifetime,
  USER,
} from "./photo-lifetime.support.js"

describe("photo lifetime model", () => {
  beforeAll(async () => {
    await startPhotoLifetime()
  }, 30_000)

  afterAll(async () => {
    await stopPhotoLifetime()
  })

  it("keeps every referenced photo across upload, edit, undo, copy, confirm and sweep", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.commands(
          commands.map((build) => fc.constant(build())),
          { maxCommands: 6 }
        ),
        async (generated) => {
          await fc.asyncModelRun(async () => {
            await reset()
            return {
              model: { docs: [], files: [], activities: [] },
              real: { userId: USER },
            }
          }, generated)
        }
      ),
      { numRuns: RUNS, seed: SEED }
    )
  }, 60_000)
})
