export const PAPER_ENGINE_ROOT = "packages/paper-engine/src/"

export const PURE_HINT =
  "packages/paper-engine is pure: take time and ids from Ports, and leave DOM, Node, database, server and AI SDK code to apps"

const IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm

const BANNED_IMPORTS = [
  [/^node:/, "Node built-in"],
  [
    /^(?:fs|path|os|crypto|child_process|http|https|net|url|worker_threads|stream)(?:\/|$)/,
    "Node built-in",
  ],
  [/^(?:drizzle-orm|pg|postgres|@electric-sql\/pglite)(?:\/|$)/, "database"],
  [/^(?:hono|@hono\/)/, "server"],
  [/^@workspace\/(?:api|web)(?:\/|$)/, "app"],
  [/^(?:ai|openai|@ai-sdk\/|@anthropic-ai\/|@openrouter\/)/, "AI SDK"],
]

const BANNED_CALLS = [
  [/\bDate\.now\s*\(/g, "Date.now"],
  [/\bnew\s+Date\s*\(/g, "new Date"],
  [/\bMath\.random\s*\(/g, "Math.random"],
  [/\bperformance\.now\s*\(/g, "performance.now"],
  [/\bcrypto\.(?:randomUUID|getRandomValues)\s*\(/g, "crypto randomness"],
  [
    /(?<![\w.$\/-])(?:window|document|navigator|localStorage|sessionStorage|location|globalThis\.document)\s*[.([]/g,
    "DOM global",
  ],
  [
    /\b(?:requestAnimationFrame|getComputedStyle|DOMParser|HTMLElement|MutationObserver)\b/g,
    "DOM API",
  ],
]

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function paperEnginePurityProblems(source, fileName) {
  if (!fileName.startsWith(PAPER_ENGINE_ROOT)) return []
  const problems = []
  for (const match of source.matchAll(IMPORT)) {
    const found = BANNED_IMPORTS.find(([pattern]) => pattern.test(match[1]))
    if (found) {
      problems.push(
        `${fileName}:${lineOf(source, match.index)}: imports ${match[1]} (${found[1]}); ${PURE_HINT}`
      )
    }
  }
  for (const [pattern, label] of BANNED_CALLS) {
    for (const match of source.matchAll(pattern)) {
      problems.push(
        `${fileName}:${lineOf(source, match.index)}: ${match[0].trim()} (${label}); ${PURE_HINT}`
      )
    }
  }
  return problems
}
