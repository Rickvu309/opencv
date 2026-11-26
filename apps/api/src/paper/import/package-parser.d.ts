declare module "@xmldom/xmldom/lib/dom-parser.js" {
  export class DOMParser {
    constructor(options: {
      errorHandler: {
        warning: (message: string) => never
        error: (message: string) => never
        fatalError: (message: string) => never
      }
    })
    parseFromString(source: string, mimeType: "application/xml"): unknown
  }
}
