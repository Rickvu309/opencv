import { randomUUID } from "node:crypto"
import { rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import type { TestProject } from "vitest/node"

import { migrationsFolder } from "../db/paths.js"
import * as schema from "../db/schema.js"

declare module "vitest" {
  export interface ProvidedContext {
    pgliteTemplatePath: string
  }
}

export default async function setup(project: TestProject) {
  const client = new PGlite()
  await migrate(drizzle({ client, schema }), { migrationsFolder })
  const dump = await client.dumpDataDir("none")
  await client.close()

  const templatePath = path.join(
    os.tmpdir(),
    `pglite-template-${randomUUID()}.tar`
  )
  await writeFile(templatePath, new Uint8Array(await dump.arrayBuffer()))
  project.provide("pgliteTemplatePath", templatePath)

  return async () => {
    await rm(templatePath, { force: true })
  }
}
