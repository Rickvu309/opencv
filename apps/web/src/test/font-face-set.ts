export class TestFontFaceSet extends Set<FontFace> {
  readonly ready: Promise<this>
  readonly status = "loaded"
  onloading: FontFaceSet["onloading"] = null
  onloadingdone: FontFaceSet["onloadingdone"] = null
  onloadingerror: FontFaceSet["onloadingerror"] = null
  private readonly events = new EventTarget()
  readonly addEventListener = this.events.addEventListener.bind(this.events)
  readonly removeEventListener = this.events.removeEventListener.bind(
    this.events
  )
  readonly dispatchEvent = this.events.dispatchEvent.bind(this.events)

  constructor(ready: Promise<unknown> = Promise.resolve()) {
    super()
    this.ready = ready.then(() => this)
  }

  check() {
    return true
  }

  async load() {
    await this.ready
    return [...this]
  }
}

export function installTestFonts(ready?: Promise<unknown>) {
  const fonts = new TestFontFaceSet(ready)
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  })
  return fonts
}
