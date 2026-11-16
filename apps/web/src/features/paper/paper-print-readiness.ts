function printSheets() {
  return [...document.querySelectorAll<HTMLElement>("[data-paper-print]")]
}

function photoSource(image: HTMLImageElement) {
  return JSON.stringify([
    image.getAttribute("src"),
    image.getAttribute("srcset"),
    image.getAttribute("sizes"),
    [...(image.closest("picture")?.querySelectorAll("source") ?? [])].map(
      (source) => [source.srcset, source.sizes, source.media, source.type]
    ),
  ])
}

function textFonts(sheets: HTMLElement[]) {
  const fonts: { node: Node; text: string; font: string }[] = []
  for (const sheet of sheets) {
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const parent = node.parentElement
      const text = node.textContent ?? ""
      if (!text.trim() || !parent || parent.closest("[hidden]")) continue
      const style = getComputedStyle(parent)
      if (style.display === "none") continue
      const font = `${style.fontStyle || "normal"} ${style.fontWeight || "400"} ${style.fontSize || "16px"} ${style.fontFamily || "sans-serif"}`
      fonts.push({ node, text, font })
    }
  }
  return fonts
}

function loadedPhoto(image: HTMLImageElement) {
  return Boolean(
    (image.currentSrc ||
      image.getAttribute("src") ||
      image.getAttribute("srcset")) &&
    image.complete &&
    image.naturalWidth > 0 &&
    image.naturalHeight > 0
  )
}

async function readyPhoto(image: HTMLImageElement, signal: AbortSignal) {
  if (typeof image.decode === "function") {
    await image.decode()
  } else if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      const clear = () => {
        image.removeEventListener("load", load)
        image.removeEventListener("error", fail)
        signal.removeEventListener("abort", fail)
      }
      const load = () => {
        clear()
        resolve()
      }
      const fail = () => {
        clear()
        reject(new Error("Photo unavailable"))
      }
      image.addEventListener("load", load, { once: true })
      image.addEventListener("error", fail, { once: true })
      signal.addEventListener("abort", fail, { once: true })
      if (signal.aborted) fail()
    })
  }
  if (!loadedPhoto(image)) throw new Error("Photo unavailable")
}

export function capturePrintReadiness(signal: AbortSignal) {
  const sheets = printSheets()
  const photos = sheets
    .flatMap((sheet) => [...sheet.querySelectorAll("img")])
    .map((image) => ({
      image,
      source: photoSource(image),
      selected: image.currentSrc,
    }))
  const fonts = textFonts(sheets)
  const fontTexts = new Map<string, string>()
  for (const { font, text } of fonts) {
    fontTexts.set(font, (fontTexts.get(font) ?? "") + text)
  }
  const requiredFonts = [...fontTexts].map(([font, text]) => ({ font, text }))
  const matches = () => {
    const current = printSheets()
    const images = current.flatMap((sheet) => [
      ...sheet.querySelectorAll("img"),
    ])
    const currentFonts = textFonts(current)
    return (
      !signal.aborted &&
      current.length === sheets.length &&
      current.every(
        (sheet, index) => sheet === sheets[index] && sheet.isConnected
      ) &&
      images.length === photos.length &&
      photos.every(
        ({ image, source, selected }, index) =>
          image === images[index] &&
          photoSource(image) === source &&
          (!selected || image.currentSrc === selected)
      ) &&
      currentFonts.length === fonts.length &&
      fonts.every((font, index) => {
        const currentFont = currentFonts[index]
        return (
          currentFont?.node === font.node &&
          currentFont.text === font.text &&
          currentFont.font === font.font
        )
      })
    )
  }
  const ready = Promise.all([
    ...photos.map(async (photo) => {
      await readyPhoto(photo.image, signal)
      if (!matches()) throw new Error("Paper changed")
      photo.selected = photo.image.currentSrc
    }),
    ...requiredFonts.map(async ({ font, text }) => {
      if (!document.fonts) return
      const faces = await document.fonts.load(font, text)
      if (
        faces.some((face) => face.status !== "loaded") ||
        !document.fonts.check(font, text)
      )
        throw new Error("Font unavailable")
    }),
  ])
  return {
    ready,
    isCurrent: () =>
      matches() &&
      photos.every(({ image }) => loadedPhoto(image)) &&
      requiredFonts.every(
        ({ font, text }) => !document.fonts || document.fonts.check(font, text)
      ),
  }
}
