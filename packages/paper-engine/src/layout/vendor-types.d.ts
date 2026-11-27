declare module "linebreak" {
  export type Break = { position: number; required: boolean }
  export default class LineBreaker {
    constructor(text: string)
    nextBreak(): Break | null
  }
}

interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { eager: true; import: "default" }
  ): Record<string, T>
}
