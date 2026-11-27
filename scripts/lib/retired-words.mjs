const TEXT_FILE = /\.(?:[cm]?[jt]sx?|css|json|md|ya?ml)$/
const SOURCE = /^(?:apps|packages)\/[^/]+\/src\//
const GUARD_FILES = /^scripts\/(?:retired-words\.test|lib\/retired-words)\.mjs$/
const CHECKING_GLOSSARY = /^scripts\/GLOSSARY\.md$/

const checkingWord = (id, word, say) => ({
  id,
  word,
  scope: () => true,
  content: (file) => TEXT_FILE.test(file),
  hint: `scripts/GLOSSARY.md retired this word for how a change is checked, so say ${say}. If it is a legitimate use, add the path and the exact word to the allowed list in scripts/lib/retired-words.mjs with a reason.`,
  allowed: [
    {
      path: CHECKING_GLOSSARY,
      why: "the checking glossary lists the words to avoid",
    },
    {
      path: GUARD_FILES,
      why: "the guard names the word it bars",
    },
  ],
})

export const RETIRED = [
  {
    id: "thread",
    word: /[\w-]*thread[\w-]*/gi,
    scope: (file) => SOURCE.test(file),
    content: (file) => TEXT_FILE.test(file),
    hint: "AGENTS.md retired this word, so say Chat or Job. If it is a legitimate use, such as an Inbox mail thread, add the path and the exact word to the allowed list in scripts/lib/retired-words.mjs with a reason.",
    allowed: [
      {
        path: /^apps\/api\/src\/coach\/inbox-usage\.test\.ts$/,
        match: /^(threadId|threads)$/,
        why: "the native Coach transport fixture verifies usage for Inbox mail threads",
      },
      {
        path: /^apps\/api\/src\/paper\/import\/(?:import-text-(?:pool|worker)|import-read-fairness\.test)\.ts$/,
        match: /^worker_threads$/,
        line: /^import \{ (?:Worker|parentPort, workerData) \} from "node:worker_threads"$/,
        why: "Node's worker_threads module runs the PDF and Word readers away from the API request loop",
      },
      {
        path: /^apps\/api\/src\/coach\/anthropic-runtime\.ts$/,
        match: /^thread$/,
        line: /^\s*thread: false,$/,
        why: "the Anthropic SDK option disables provider conversation storage for request-bound Chat history",
      },
      {
        path: /^(?:apps\/api\/src\/inbox\/|apps\/api\/src\/registry\/(?:coverage-inbox\.test-support|inbox-contract\.test|invalidation\.formal\.test|registry\.undo-later\.formal\.test)\.ts$|packages\/domain\/src\/inbox(?:[\w.-]*\.ts$|\/)|packages\/domain\/src\/operations\/inbox\/|apps\/web\/src\/features\/inbox\/|apps\/web\/src\/test\/inbox-fixtures\.ts$|apps\/api\/src\/scenarios\/inbox\.scenario\.test\.ts$)/,
        why: "the inbox modules own the mail thread noun (MailThread, InboxThread, threadId, listThreads, getThread)",
      },
      {
        path: /^apps\/api\/src\/db\/(?:schema|migrate\.test)\.ts$/,
        match:
          /^(?:inbox_threads|inboxThreads|provider_thread_id|providerThreadId|thread_id|threadId|inbox_threads_connection_provider_uidx|inbox_messages_thread_provider_uidx)$/,
        why: "inbox_threads is the mail thread table and its columns",
      },
      {
        path: /^apps\/api\/src\/paper\/photo-references\.ts$/,
        match: /^inbox_threads$/,
        why: "the photo scan names the inbox_threads table so a new document column there cannot skip the check",
      },
      {
        path: /^apps\/api\/src\/registry\/ownership\.test\.ts$/,
        match: /^inboxThreads$/,
        why: "maps the inbox_threads table to the inbox module",
      },
      {
        path: /^apps\/api\/src\/(?:registry\/owned|test\/routes\/route-cases)\.ts$/,
        match: /^(?:inboxThreads|threadId|providerThreadId)$/,
        why: "the owned-row kind names the inbox_threads table and the threadId input of inbox.get, and the inbox route case seeds one mail thread row",
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
        path: /^apps\/web\/src\/(?:features\/app-shell\/shell-api|test\/shell-api-mock)\.ts$|^apps\/web\/src\/features\/app-shell\/app-shell\.isolated\.test\.tsx$|^apps\/web\/src\/features\/app-shell\/app-sidebar(?:-parity)?\.test\.tsx$|^apps\/web\/src\/test\/nav-contract\.test\.tsx$/,
        match: /^threads$/,
        why: "the inbox list response field is named threads",
      },
      {
        path: /^packages\/domain\/src\/operations\/chat\/set-focus\/operation\.ts$/,
        match: /^thread$/,
        line: /inbox thread/,
        why: "a chat can point at an inbox thread",
      },
      {
        path: /^packages\/domain\/src\/coach\/chat-messages\.ts$/,
        match: /^Thread$/,
        line: /"New Thread"/,
        why: 'LEGACY_CHAT_TITLE = "New Thread" allows legacy rows to display and rename as New chat (#548)',
      },
      {
        path: /^packages\/ui\/src\/(?:components\/comment-thread\.tsx|kit-contracts\.test\.tsx)$/,
        why: "the ui comment-thread component and its kit test are a stack of review comments, not a conversation with the Coach",
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
    id: "opportunity",
    word: /[\w-]*opportunit[\w-]*/gi,
    scope: (file) => SOURCE.test(file),
    content: (file) => TEXT_FILE.test(file),
    hint: "AGENTS.md retired this word, so say Chat or Job.",
    allowed: [],
  },
  {
    id: "openpath",
    word: /openpath/gi,
    scope: (file) => !file.startsWith("docs/adr/"),
    content: () => true,
    hint: "The project was renamed to OpenCV, so say OpenCV. docs/adr keeps the old name as history. Otherwise add the path and the exact word to the allowed list in scripts/lib/retired-words.mjs with a reason.",
    allowed: [
      {
        path: GUARD_FILES,
        why: "the guard names the word it bars",
      },
    ],
  },
  {
    id: "pen",
    word: /\bpen(?:[- _]?dev)?\b/gi,
    scope: (file) => !file.startsWith("scripts/retired/"),
    content: () => true,
    hint: "The owner retired the old design tool and its frames on 2026-11-19. Build from the approved prototype and the packages/ui kit instead, and name styles after what they style. scripts/retired keeps the old name as history. Otherwise add the path and the exact word to the allowed list in scripts/lib/retired-words.mjs with a reason.",
    allowed: [
      {
        path: GUARD_FILES,
        why: "the guard names the word it bars",
      },
      {
        path: /^apps\/web\/src\/features\/app-shell\/sidebar-peek\.test\.tsx$/,
        line: /touch and pen pointers/,
        why: "a stylus is a pointer type the sidebar peek ignores",
      },
    ],
  },
  checkingWord(
    "known-list",
    /(?<![a-z-])[Kk]nown[- _]?[Ll]ists?(?![a-z])|(?<=[a-z])Known_?Lists?(?![a-z])|KNOWN[- _]?LISTS?/g,
    "ratchet"
  ),
  checkingWord(
    "smoke-test",
    /smoke[- _]?tests?/gi,
    "sweep, core loop run or probe"
  ),
  checkingWord(
    "risk-class",
    /(?<![a-z])[Rr]isk[- _]?[Cc]lass(?:es)?|(?<=[a-z])Risk_?Class(?:es)?|RISK[- _]?CLASS(?:ES)?/g,
    "risk label for the issue, or retirement class"
  ),
]

export function matches(text, file) {
  return RETIRED.flatMap((entry) => {
    if (!entry.scope(file)) return []
    const lines = text === null || !entry.content(file) ? [] : text.split("\n")
    const subjects = [
      { where: file, line: file },
      ...lines.map((line, index) => ({ where: `${file}:${index + 1}`, line })),
    ]
    return subjects.flatMap(({ where, line }) =>
      [...line.matchAll(entry.word)].map(([match]) => ({
        where,
        match,
        id: entry.id,
        hint: entry.hint,
        rule:
          entry.allowed.find(
            (rule) =>
              rule.path.test(file) &&
              (!rule.match || rule.match.test(match)) &&
              (!rule.line || rule.line.test(line))
          ) ?? null,
      }))
    )
  })
}

export function detect(text, file) {
  return matches(text, file)
    .filter((hit) => !hit.rule)
    .map((hit) => `${hit.where} uses "${hit.match}". ${hit.hint}`)
}
