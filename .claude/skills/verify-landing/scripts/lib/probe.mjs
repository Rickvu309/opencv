// Runs inside the page. Self-contained: it is serialised with toString(), so it cannot close over anything.
// It only measures. Every decision lives in checks-*.mjs, which read the JSON this returns.
function probe(kind) {
  if (kind === "first") {
    return new Promise((resolve) => {
      const started = performance.now()
      const tick = () => {
        const ready =
          document.querySelector("h1") && document.querySelector("main img")
        if (ready || performance.now() - started > 20000)
          resolve(probe("first-now"))
        else requestAnimationFrame(tick)
      }
      tick()
    })
  }
  const NAMES = ["capture", "plan", "assistant", "review"]
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const cs = (el) => getComputedStyle(el)
  const header = document.querySelector("header")
  const main = document.querySelector("main")
  const footer = document.querySelector("footer")
  const h1 = document.querySelector("h1")
  const sections = main
    ? [...main.children].filter((n) => n.tagName === "SECTION")
    : []
  const hero = h1 ? h1.closest("section") : null
  const closing = sections[sections.length - 1] ?? null
  const regionOf = (el) => {
    if (header && header.contains(el)) return "nav"
    if (footer && footer.contains(el)) return "footer"
    const sec = el.closest("main > section")
    if (!sec) return "other"
    if (sec === hero) return "hero"
    if (NAMES.includes(sec.id)) return `surface:${sec.id}`
    if (sec === closing) return "closing"
    return "section"
  }
  const readText = (el) => {
    const clone = el.cloneNode(true)
    clone
      .querySelectorAll("[aria-hidden='true'],style")
      .forEach((n) => n.remove())
    return clone.textContent.replace(/\s+/g, " ").trim()
  }
  const rectOf = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }
  }
  const effOpacity = (el) => {
    let o = 1
    for (let n = el; n && n.nodeType === 1; n = n.parentElement)
      o *= Number(cs(n).opacity)
    return o
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && cs(el).visibility !== "hidden"
  }
  const root = [header, main, footer].filter(Boolean)
  const ownTextEls = () =>
    [...document.querySelectorAll("header *, main *, footer *")].filter(
      (el) =>
        [...el.childNodes].some(
          (c) => c.nodeType === 3 && c.textContent.trim()
        ) &&
        el.tagName !== "STYLE" &&
        el.tagName !== "SCRIPT"
    )

  if (kind === "first-now") {
    const heroSub = hero ? hero.querySelector("h1 ~ p") : null
    const animatedText = ownTextEls()
      .filter((el) => el.getBoundingClientRect().width > 1)
      .map((el) => {
        const s = cs(el)
        const why = []
        if (effOpacity(el) < 0.95) why.push("opacity")
        if (s.filter !== "none") why.push("blur")
        if (el.getAnimations().length) why.push("animation")
        return why.length
          ? {
              region: regionOf(el),
              lead: Boolean(
                el.closest("h1") || (heroSub && heroSub.contains(el))
              ),
              text: el.textContent.trim().slice(0, 24),
              why,
            }
          : null
      })
      .filter(Boolean)
    const img = hero ? hero.querySelector("img") : null
    const frames = img
      ? img.getAnimations().flatMap((a) => a.effect.getKeyframes())
      : []
    return {
      animatedText,
      heroImg: img && {
        opacity: Number(cs(img).opacity),
        startsInvisible: frames.some((k) => Number(k.opacity) === 0),
      },
    }
  }

  if (kind === "top") {
    const vw = innerWidth
    const vh = innerHeight
    const blocks = [
      ...document.querySelectorAll("main h1,main h2,main h3,main p"),
    ].map((el) => ({
      region: regionOf(el),
      tag: el.tagName.toLowerCase(),
      text: readText(el),
      textTransform: cs(el).textTransform,
      bgImage: cs(el).backgroundImage,
      bgClip: cs(el).webkitBackgroundClip || cs(el).backgroundClip,
      fill: cs(el).webkitTextFillColor,
    }))
    const links = [
      ...document.querySelectorAll(
        "header a,header button,main a,main button,footer a,footer button,[role=dialog] a,[role=menu] a"
      ),
    ].map((el) => {
      const s = cs(el)
      const bg = rgba(s.backgroundColor)
      return {
        region: regionOf(el),
        text: readText(el),
        href: el.getAttribute("href"),
        expanded: el.getAttribute("aria-expanded"),
        visible: visible(el),
        rect: rectOf(el),
        buttonLike: bg[3] > 0.05 || parseFloat(s.borderTopWidth) > 0,
      }
    })
    const imgs = [...document.querySelectorAll("main img")].map((el) => ({
      region: regionOf(el),
      src: el.getAttribute("src"),
      alt: el.getAttribute("alt"),
      width: el.getAttribute("width"),
      height: el.getAttribute("height"),
      fetchpriority: el.getAttribute("fetchpriority"),
      loading: el.getAttribute("loading"),
      rect: rectOf(el),
    }))
    const heroImg = hero ? hero.querySelector("img") : null
    const h1el = h1
    return {
      vw,
      vh,
      blocks,
      links,
      imgs,
      heroImg: heroImg && {
        ...rectOf(heroImg),
        top: heroImg.getBoundingClientRect().top,
      },
      h1Bottom: h1el ? h1el.getBoundingClientRect().bottom : null,
      pageWidth: document.documentElement.scrollWidth,
      viewWidth: document.documentElement.clientWidth,
      description:
        document.querySelector("meta[name=description]")?.content ?? "",
      title: document.title,
      bodyText: root.map((n) => readText(n)).join(" "),
      alts: [...document.querySelectorAll("img")].map(
        (i) => i.getAttribute("alt") ?? ""
      ),
      markup: {
        blockquote: document.querySelectorAll(
          "blockquote,cite,[itemprop=review],[itemprop=ratingValue]"
        ).length,
        media: [
          ...document.querySelectorAll("video,audio,iframe,embed,object"),
        ].map((n) => n.tagName.toLowerCase()),
        autoplay: document.querySelectorAll("[autoplay]").length,
        carousel: [...document.querySelectorAll("*")].filter(
          (n) =>
            /carousel|slider|swiper|slick|marquee/i.test(
              n.getAttribute("class") ?? ""
            ) ||
            n.getAttribute("aria-roledescription") === "carousel" ||
            (cs(n).scrollSnapType !== "none" && cs(n).overflowX !== "visible")
        ).length,
        logoImgs: [...document.querySelectorAll("main img")].filter((i) =>
          /logo|partner|customer|trusted|universit/i.test(
            `${i.getAttribute("src")} ${i.getAttribute("alt")}`
          )
        ).length,
      },
      bg: (() => {
        for (
          let n = document.querySelector(".landing-root") ?? document.body;
          n;
          n = n.parentElement
        ) {
          const c = rgba(cs(n).backgroundColor)
          if (c[3] > 0.9) return c.slice(0, 3)
        }
        return [255, 255, 255]
      })(),
    }
  }

  if (kind === "deep") {
    const composite = (fg, bg) =>
      fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
    const effBg = (el) => {
      const layers = []
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = cs(n)
        if (s.backgroundImage !== "none") return null
        const c = rgba(s.backgroundColor)
        if (c[3] > 0) layers.push(c)
        if (c[3] >= 1) break
      }
      return layers
        .reverse()
        .reduce((under, c) => composite(c, under), [255, 255, 255])
    }
    const textEls = ownTextEls().filter(
      (el) => el.getBoundingClientRect().width > 1 && visible(el)
    )
    const contrast = textEls
      .map((el) => {
        const s = cs(el)
        const bg = effBg(el)
        if (!bg) return null
        const fgc = rgba(s.color)
        const fg = composite(
          [fgc[0], fgc[1], fgc[2], fgc[3] * effOpacity(el)],
          bg
        )
        const px = parseFloat(s.fontSize)
        return {
          text: el.textContent.trim().slice(0, 28),
          px,
          bold: Number(s.fontWeight) >= 700,
          fg,
          bg,
        }
      })
      .filter(Boolean)
    const colors = []
    const isShot = (el) => el.closest("picture") || el.tagName === "IMG"
    for (const el of document.querySelectorAll("header *, main *, footer *")) {
      if (isShot(el) || !visible(el) || effOpacity(el) < 0.05) continue
      const s = cs(el)
      const add = (css, use) => {
        const c = rgba(css)
        if (c[3] > 0.1)
          colors.push({
            use,
            rgb: c.slice(0, 3),
            where: el.tagName.toLowerCase(),
          })
      }
      if (
        [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
      )
        add(s.color, "text")
      add(s.backgroundColor, "fill")
      if (parseFloat(s.borderTopWidth) > 0) add(s.borderTopColor, "border")
      if (el instanceof SVGElement) {
        if (s.fill !== "none") add(s.fill, "svg")
        if (s.stroke !== "none") add(s.stroke, "svg")
      }
    }
    const targets = [
      ...document.querySelectorAll(
        "header a,header button,main a,main button,footer a,footer button"
      ),
    ]
      .filter((el) => visible(el))
      .map((el) => ({
        text: readText(el).slice(0, 24),
        href: el.getAttribute("href"),
        ...rectOf(el),
      }))
    const configured = new Map()
    const hidden = []
    const times = (v) => v.split(",").map(parseFloat)
    for (const el of document.querySelectorAll("header *, main *, footer *")) {
      const s = cs(el)
      const tag = el.tagName.toLowerCase()
      const note = (label) =>
        configured.set(label, (configured.get(label) ?? 0) + 1)
      if (
        s.animationName !== "none" &&
        times(s.animationDuration).some((t) => t > 0)
      )
        note(`animation:${s.animationName} on ${tag}`)
      const props = s.transitionProperty.split(",").map((p) => p.trim())
      const durs = times(s.transitionDuration)
      props.forEach((p, i) => {
        if (durs[i % durs.length] > 0) note(`transition:${p} on ${tag}`)
      })
    }
    for (const el of textEls) {
      if (effOpacity(el) < 0.95 || cs(el).filter !== "none")
        hidden.push(el.textContent.trim().slice(0, 24))
    }
    return {
      contrast,
      colors,
      targets,
      running: document
        .getAnimations()
        .filter((a) => a.playState === "running" || a.playState === "pending")
        .map((a) => a.animationName ?? a.transitionProperty ?? "animation"),
      configured: [...configured].map(([label, n]) => `${label} x${n}`),
      hidden,
      scrollBehavior: cs(document.documentElement).scrollBehavior,
    }
  }
  throw new Error(`unknown probe ${kind}`)
}

export const probeSource = (kind) => `(${probe})(${JSON.stringify(kind)})`
