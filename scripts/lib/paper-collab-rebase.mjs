const stockRebase =
  /import\s*\{[^}]*\b(?:receiveTransaction|rebaseSteps)\b[^}]*\}\s*from\s*["']prosemirror-collab["']/

export const PAPER_ENGINE_SOURCE = "packages/paper-engine/src"

export function usesStockRebase(source) {
  return stockRebase.test(source)
}
