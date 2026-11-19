import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { stageNamesReadTwice } from "./lib/stage-name-read-twice.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const scannedFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/web/src"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => !/\.test\.tsx$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

const MISTAKES = [
  `<DropdownMenuItem>
    <StageIcon stage={stage} />
    {stageLabel(stage)}
  </DropdownMenuItem>`,
  `<div data-slot="board-lane">
    <StageIcon stage={stage} />
    <h2 className="text-[13px]" tabIndex={0}>
      {name}
    </h2>
  </div>`,
  `<Button>
    <StageIcon stage={job.stage} />
    <RailLabel>{railStageLabel(job.stage)}</RailLabel>
  </Button>`,
  `<Button>
    <StageIcon stage="closed" />
    <span>Closed</span>
  </Button>`,
]

const CLEAN = [
  `<DropdownMenuItem>
    <StageIcon stage={stage} decorative />
    {stageLabel(stage)}
  </DropdownMenuItem>`,
  `<span className="mt-1 flex items-start gap-2">
    <StageIcon stage={job.stage} className="mt-[2.5px]" />
    <span className="line-clamp-2">{job.title}</span>
  </span>`,
  `<p>
    <StageIcon stage={detail.job.stage} />
    {\`Linked to \${detail.job.title} in Apply\`}
  </p>`,
]

test("a labelled stage icon beside a written stage name fires", () => {
  for (const source of MISTAKES) {
    assert.ok(stageNamesReadTwice(source).length > 0, source)
  }
})

test("a decorative icon, or a labelled icon with no stage name beside it, stays quiet", () => {
  for (const source of CLEAN) {
    assert.deepEqual(stageNamesReadTwice(source), [], source)
  }
})

test("the web app never pairs a labelled stage icon with its written name", () => {
  const problems = []
  for (const file of scannedFiles()) {
    problems.push(
      ...stageNamesReadTwice(readFileSync(path.join(root, file), "utf8"), file)
    )
  }
  assert.deepEqual(problems, [])
})
