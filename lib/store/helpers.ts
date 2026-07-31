// Small runtime helpers shared by every domain reducer and by the
// StoreProvider's action-creator callbacks: a stable date stamp and a
// lightweight id generator for objects created at runtime (a pasted
// opportunity, a tailored CV, an activity moment). Kept dependency-free so
// every reducer file can import it without pulling in React.

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
