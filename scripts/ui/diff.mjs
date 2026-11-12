export async function diffImages(browser, before, after) {
  const page = await browser.newPage()
  try {
    return await page.evaluate(
      async ({ before, after }) => {
        const load = (src) =>
          new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error("not a readable image"))
            image.src = src
          })
        const [a, b] = await Promise.all([load(before), load(after)])
        const width = Math.max(a.width, b.width)
        const height = Math.max(a.height, b.height)
        const pixels = (image) => {
          const canvas = new OffscreenCanvas(width, height)
          const context = canvas.getContext("2d")
          context.drawImage(image, 0, 0)
          return context.getImageData(0, 0, width, height).data
        }
        const left = pixels(a)
        const right = pixels(b)
        const out = new OffscreenCanvas(width, height)
        const outContext = out.getContext("2d")
        const result = outContext.createImageData(width, height)
        let different = 0
        for (let at = 0; at < left.length; at += 4) {
          const changed =
            left[at] !== right[at] ||
            left[at + 1] !== right[at + 1] ||
            left[at + 2] !== right[at + 2] ||
            left[at + 3] !== right[at + 3]
          if (changed) different += 1
          const shade =
            Math.round((left[at] + left[at + 1] + left[at + 2]) / 12) + 170
          result.data.set(
            changed ? [230, 30, 60, 255] : [shade, shade, shade, 255],
            at
          )
        }
        outContext.putImageData(result, 0, 0)
        const blob = await out.convertToBlob({ type: "image/png" })
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ""
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return {
          before: { width: a.width, height: a.height },
          after: { width: b.width, height: b.height },
          different,
          total: width * height,
          png: btoa(binary),
        }
      },
      { before, after }
    )
  } finally {
    await page.close()
  }
}
