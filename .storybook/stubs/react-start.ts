type Chain = {
  inputValidator: (schema?: unknown) => Chain;
  handler: (fn?: unknown) => (...args: unknown[]) => Promise<unknown>;
};

export function createServerFn(_opts?: unknown): Chain {
  const chain: Chain = {
    inputValidator: () => chain,
    handler: () => async () => ({}),
  };
  return chain;
}
