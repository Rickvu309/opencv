type CatalogFailure = Error & { stderr?: string | Uint8Array }

type CatalogServer = {
  httpServer: { once(event: "close", listener: () => void): unknown } | null
  ws: {
    send(
      message:
        | { type: "error"; err: { message: string; stack: string } }
        | { type: "full-reload" }
    ): void
  }
  middlewares: {
    use(
      handler: (
        request: unknown,
        response: { statusCode: number; end(body: string): unknown },
        next: () => void
      ) => void
    ): unknown
  }
}

export function runCatalog(mode: string, root?: string): string
export function watchCatalog(
  root: string,
  onResult: (error: CatalogFailure | null, result?: string) => void
): () => void
export function catalogDev(command: string[], root?: string): Promise<void>
export function catalogPlugin(root?: string): {
  name: string
  buildStart(): void
  configureServer(server: CatalogServer): void
}
