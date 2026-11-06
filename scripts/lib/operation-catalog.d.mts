export type CatalogErrorKind =
  | "missing-implementation"
  | "orphan-implementation"
  | "duplicate-name"
  | "namespace-mismatch"
  | "unexportable-schema"
  | "stale-output"
  | "browser-import"

export class CatalogError extends Error {
  readonly kind: CatalogErrorKind
  readonly file: string
  constructor(kind: CatalogErrorKind, file: string, detail: string)
}

type CatalogSnapshot = {
  operations: {
    file: string
    name: string
    owner: string
    namespace: string
    directory: string
    schemas?: unknown
    schemaError?: string
  }[]
  servers: {
    file: string
    operation: string
    owner: string
    namespace: string
    directory: string
  }[]
  sources?: [string, string][]
  browserSources?: string[]
  boundaryErrors?: { file: string; detail: string }[]
}

export function digestOf(snapshot: unknown): string
export function detect(
  snapshot: CatalogSnapshot | string,
  digest?: string
): CatalogError[]
export function renderCatalog(snapshot: CatalogSnapshot): Record<string, string>

export function detectBrowserMetadata(
  file: string,
  text: string
): { file: string; detail: string }[]
