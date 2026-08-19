export async function resetPool() {}

export function databaseUrl() {
  return undefined;
}

export function getPool(): never {
  throw new Error("DATABASE_URL is required");
}

export async function withClient<T>(_fn: (client: never) => Promise<T>): Promise<T> {
  throw new Error("DATABASE_URL is required");
}

export async function withTx<T>(_fn: (client: never) => Promise<T>): Promise<T> {
  throw new Error("DATABASE_URL is required");
}

export function quoteIdent(value: string) {
  return `"${value}"`;
}
