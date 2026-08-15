/**
 * The next free id under a prefix.
 *
 * Counting the list would reuse an id after a removal, and ids are what every
 * edit action targets: reusing one means an edit aimed at a deleted entry
 * silently lands on its replacement.
 */
export function nextId(prefix: string, existing: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const id of existing) {
    const match = id.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${highest + 1}`;
}
