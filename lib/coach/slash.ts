/**
 * Trailing "/query" in the composer, the same token PromptInput uses for
 * skills. Ours opens the state-aware suggestions, not a fake skill list.
 */

export function slashToken(
  draft: string,
): { query: string; from: number } | null {
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(draft);
  if (!match || match.index === undefined) return null;
  return {
    query: match[1],
    from: match.index + match[0].indexOf("/"),
  };
}

export function filterBySlash(
  items: readonly string[],
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => item.toLowerCase().includes(needle));
}

export function applySlash(
  draft: string,
  from: number,
  insertion: string,
): string {
  return `${draft.slice(0, from)}${insertion}`;
}
