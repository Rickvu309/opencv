declare namespace PDFKit.Mixins {
  interface PDFText {
    text(
      text: string,
      x: number,
      y: number,
      options: PositionedTextOptions
    ): this
    widthOfString(text: string, options: PositionedTextOptions): number
  }

  interface PositionedTextOptions extends Omit<TextOptions, "features"> {
    features: Readonly<Record<string, boolean>>
    horizontalScaling?: number
  }
}
