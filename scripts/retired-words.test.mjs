import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const SCANNED = /^(?:apps|packages)\/[^/]+\/src\//
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|css|json|md|ya?ml)$/

/**
 * A hit is allowed when some entry's `path` matches the file, its `match`
 * (when given) matches the whole retired word that was hit, and its `line`
 * (when given) matches the line or file name around it. Anchor `match` so a
 * second identifier on the same line cannot ride along.
 *
 * The old Apply stage ids (inbox, prep, sent, live) are not guarded yet: the
 * code still stores them until #437 renames them.
 */
const RETIRED = [
  {
    word: /[\w-]*thread[\w-]*/gi,
    use: "Chat",
    allowed: [
      {
        path: /^(?:apps\/api\/src\/inbox\/|apps\/api\/src\/registry\/(?:coverage-inbox|inbox-contract\.test)\.ts$|packages\/domain\/src\/inbox[\w.-]*\.ts$|apps\/web\/src\/features\/inbox\/|apps\/web\/src\/test\/inbox-fixtures\.ts$)/,
        why: "the inbox modules own the mail thread noun (MailThread, InboxThread, threadId, listThreads, getThread)",
      },
      {
        path: /^apps\/api\/src\/db\/(?:schema|migrate\.test)\.ts$/,
        match:
          /^(?:inbox_threads|inboxThreads|provider_thread_id|providerThreadId|thread_id|threadId|inbox_threads_connection_provider_uidx|inbox_messages_thread_provider_uidx)$/,
        why: "inbox_threads is the mail thread table and its columns",
      },
      {
        path: /^apps\/api\/src\/registry\/ownership\.test\.ts$/,
        match: /^inboxThreads$/,
        why: "maps the inbox_threads table to the inbox module",
      },
      {
        path: /^apps\/api\/src\/registry\/contract\.type-test\.ts$/,
        match: /^threadId$/,
        why: "the inbox snooze input is keyed by an inbox threadId",
      },
      {
        path: /^apps\/api\/src\/registry\/names\.test\.ts$/,
        match: /^threads$/,
        line: /\|threads\|/,
        why: "the retired threads.* tool prefix stays in the name scan so old tool names fail",
      },
      {
        path: /^apps\/web\/src\/lib\/requests\.ts$/,
        match: /^(?:[a-z]*InboxThreads?|inboxThreads?|threadId)$/,
        why: "the inbox thread route is keyed by an inbox threadId",
      },
      {
        path: /^apps\/web\/src\/(?:features\/app-shell\/shell-api|test\/shell-api-mock)\.ts$|^apps\/web\/src\/features\/app-shell\/app-shell\.test\.tsx$/,
        match: /^threads$/,
        why: "the inbox list response field is named threads",
      },
      {
        path: /^packages\/domain\/src\/chat-contract\.ts$/,
        match: /^thread$/,
        line: /inbox thread/,
        why: "a chat can point at an inbox thread",
      },
      {
        path: /^packages\/ui\/src\/components\/comment-thread\.tsx$/,
        why: "the ui comment-thread component is a stack of review comments, not a conversation with the Coach",
      },
      {
        path: /^apps\/web\/src\/features\/app-shell\/shell-chrome\.test\.ts$/,
        match: /^HomeThread$/,
        line: /HomeThread/,
        why: "tombstone: asserts the retired HomeThread hook stays out of shell chrome",
      },
      {
        path: /^apps\/web\/src\/features\/coach\/use-coach-turn\.test\.ts$/,
        match: /^(?:coach-thread-panel|Thread)$/,
        line: /coach-thread-panel|paperCoach\(Thread\|Chat\)StorageKey/,
        why: "tombstone: asserts the retired paper coach thread panel and storage key stay deleted",
      },
    ],
  },
  {
    word: /[\w-]*opportunit[\w-]*/gi,
    use: "Job",
    allowed: [],
  },
]

function scannedFiles() {
  return execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
    .split("\0")
    .filter((file) => SCANNED.test(file) && existsSync(path.join(root, file)))
}

function subjects(file) {
  const lines = TEXT_FILE.test(file)
    ? readFileSync(path.join(root, file), "utf8").split("\n")
    : []
  return [
    { where: file, text: file },
    ...lines.map((text, index) => ({ where: `${file}:${index + 1}`, text })),
  ]
}

function scan() {
  const used = new Set()
  const violations = []
  for (const file of scannedFiles()) {
    for (const { where, text } of subjects(file)) {
      for (const entry of RETIRED) {
        for (const [match] of text.matchAll(entry.word)) {
          const allowed = entry.allowed.find(
            (rule) =>
              rule.path.test(file) &&
              (!rule.match || rule.match.test(match)) &&
              (!rule.line || rule.line.test(text))
          )
          if (allowed) used.add(allowed)
          else
            violations.push(
              `${where} uses "${match}". CONTEXT.md retired this word, so say ${entry.use}. If it is a legitimate use, such as an Inbox mail thread, add the path and the exact word to the allowed list in scripts/retired-words.test.mjs with a reason.`
            )
        }
      }
    }
  }
  return { used, violations }
}

const { used, violations } = scan()

test("no source file or file name uses a word CONTEXT.md retired", () => {
  assert.deepEqual(violations, [], `\n${violations.join("\n")}`)
})

test("every allowed retired-word use still matches something", () => {
  const stale = RETIRED.flatMap((entry) => entry.allowed).filter(
    (rule) => !used.has(rule)
  )
  assert.deepEqual(
    stale.map((rule) => rule.why),
    [],
    "These allowed entries in scripts/retired-words.test.mjs match nothing now. Delete them."
  )
})
