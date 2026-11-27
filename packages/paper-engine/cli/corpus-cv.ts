import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  corpusDocument,
  type CorpusCv,
} from "../src/layout/corpus-paper.test-support.js"

export function readCorpusCv(id: string) {
  const file = fileURLToPath(
    new URL(
      `../../paper-corpus/tests/fixtures/cvs/${id}.expected.json`,
      import.meta.url
    )
  )
  return corpusDocument(JSON.parse(readFileSync(file, "utf8")) as CorpusCv)
}
