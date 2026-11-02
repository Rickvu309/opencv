import { staleIf, verdict } from "./verdict.mjs"

const SURFACES = ["paper", "apply", "coach"]
export const isSignUpLink = (l) =>
  l.href === "/sign-in" && !/^log in$/i.test(l.text)
const words = (s) => s.split(/\s+/).filter(Boolean)
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean)
const quote = (list) =>
  list.length ? list.map((s) => `"${s}"`).join(", ") : "none"

const OUTCOME =
  /\b(job|jobs|role|roles|offer|interview|interviews|career|cv|hired|internship|seat)\b/i
const AUDIENCE =
  /\b(student|students|graduate|graduates|grad|grads|intern|interns)\b/i
const MARKETESE =
  /(?<![\w#])#1(?!\w)|(?<!\w)(?:best|dream|seamless|seamlessly|empower\w*|revolutioni[sz]\w*|supercharge\w*|unlock\w*|cutting-edge|world-class|game-chang\w*|next-level)(?!\w)/gi
const ALLOWED = /\byour best work\b|\bdream seat\b|\bfits best\b/gi
const GENERIC_LABEL =
  /^(get started|learn more|click here|(start|get|try|join|begin|sign up)( (now|free|for free|today|here|started))?)$/i

export const findMarketese = (text) =>
  [...text.replace(ALLOWED, " ").matchAll(MARKETESE)].map((m) => m[0])
const PASSIVE =
  /\b(is|are|was|were|be|been|being)\s+(\w+ed|built|made|given|written|shown|done|known|taken|seen|kept|found|sent|chosen|held)\b/i

const part = (top, test) => top.blocks.filter((b) => test(b.region))
const sentenceTexts = (top) =>
  part(top, (r) => r === "hero" || r.startsWith("surface:"))
    .filter((b) => b.tag === "p")
    .flatMap((b) =>
      sentences(b.text).map((text) => ({ region: b.region, text }))
    )

export function textRules(top, want = () => true) {
  const h1 = top.blocks.find((b) => b.tag === "h1")?.text ?? ""
  const subBlock = part(top, (r) => r === "hero").find((b) => b.tag === "p")
  const sub = subBlock?.text ?? ""
  const subSentences = sentences(sub)
  const out = []

  const outcome = OUTCOME.exec(h1)?.[0]
  const audience = AUDIENCE.exec(h1)?.[0]
  out.push(
    verdict(
      "01",
      "h1-length-and-aim",
      "H1 is 12 words or fewer and names the audience or the outcome",
      words(h1).length <= 12 && Boolean(outcome || audience),
      `${words(h1).length} words, outcome=${outcome ?? "none"}, audience=${audience ?? "none"}`
    )
  )

  const namesWork = top.blocks.some(
    (b) =>
      b.region !== "nav" && /\bopencv\b/.test(b.text) && /\bCV\b/.test(b.text)
  )
  if (want("02"))
    out.push(
      verdict(
        "02",
        "statement-names-cv",
        'A block outside the nav names "opencv" and "CV" (the statement carries the product, not the H1)',
        namesWork,
        `statement names opencv and CV=${namesWork}`
      )
    )

  const listItems = Math.max(
    0,
    ...subSentences.map((s) => s.split(/,\s*(?:and\s+)?/).length)
  )
  out.push(
    verdict(
      "03",
      "subhead-two-beats",
      "Subhead is 1 to 2 sentences and is not a 3+ item feature list",
      subSentences.length >= 1 && subSentences.length <= 2 && listItems < 3,
      `${subSentences.length} sentence(s), longest list=${listItems} items`
    )
  )

  const copy = [...top.blocks.map((b) => b.text), top.description, top.title]
  const hits = copy.flatMap(findMarketese)
  out.push(
    verdict(
      "04",
      "no-marketese",
      'No best, #1, dream, seamless, empower, revolutionize, supercharge (list in text-rules.mjs; "your best work", "dream seat" and "fits best" are exempt)',
      hits.length === 0,
      `hits: ${quote([...new Set(hits)])}`
    )
  )

  const all = sentenceTexts(top)
  const long = all.filter((s) => words(s.text).length > 24)
  const passive = all.filter((s) => PASSIVE.test(s.text))
  out.push(
    verdict(
      "05",
      "plain-sentences",
      "Hero and feature sentences are 24 words or fewer and not passive (regex heuristic for passive). The design's plan line is 21 words.",
      all.length > 0 && long.length + passive.length === 0,
      `${all.length} sentences, ${long.length} over 24 words, ${passive.length} passive${passive[0] ? `: ${quote([passive[0].text])}` : ""}`
    )
  )

  if (want("06")) {
    const titles = SURFACES.map((name) => {
      const block = top.blocks.find(
        (b) => b.region === `surface:${name}` && b.tag === "h2"
      )
      const h2 = block?.text ?? ""
      const count = words(h2).length
      return { name, h2, found: Boolean(block), ok: count >= 1 && count <= 3 }
    })
    const bad = titles.filter((t) => !t.ok)
    out.push(
      verdict(
        "06",
        "product-titles-name-the-surface",
        "Each product title (paper, apply, coach) is 1 to 3 words; a surface with no h2 is off",
        bad.length === 0,
        bad.length
          ? `off: ${bad.map((t) => `${t.name}->${t.found ? `"${t.h2}"` : "no h2"}`).join(", ")}`
          : "all three titles are 1 to 3 words"
      )
    )
  }

  const signUps = top.links.filter(
    (l) => isSignUpLink(l) && ["nav", "hero", "closing"].includes(l.region)
  )
  const regions = ["nav", "closing"]
  const labels = regions.map((r) => ({
    r,
    texts: signUps.filter((l) => l.region === r).map((l) => l.text),
  }))
  const heroSignUp = signUps.filter((l) => l.region === "hero")
  const distinct = new Set(labels.flatMap((l) => l.texts))
  if (want("07"))
    out.push(
      verdict(
        "07",
        "one-primary-label",
        "One sign-up label in the nav and one in the closing band, and none in the hero",
        distinct.size === 1 &&
          labels.every((l) => l.texts.length === 1) &&
          heroSignUp.length === 0,
        `${labels.map((l) => `${l.r}=${quote(l.texts)}`).join(" ")} hero=${heroSignUp.length}`
      )
    )

  if (want("08")) {
    const label = [...distinct][0] ?? ""
    out.push(
      verdict(
        "08",
        "label-has-object",
        'The sign-up label is the design label "Get started", or another 2+ word label that is not a bare verb (Start free, Learn more, Join)',
        words(label).length >= 2 &&
          (label === "Get started" || !GENERIC_LABEL.test(label)),
        `label ${quote([label])}, ${words(label).length} words`
      )
    )
  }

  const objection = /\byour\s+(own\s+)?(cv|work|goals|story)\b/i
  const firstSurface = top.blocks.findIndex((b) =>
    b.region.startsWith("surface:")
  )
  const objectionAt = top.blocks.findIndex(
    (b) => b.region !== "nav" && objection.test(b.text)
  )
  const answered =
    firstSurface > 0 && objectionAt >= 0 && objectionAt < firstSurface
  out.push(
    staleIf(
      firstSurface < 0 ? "no block in a surface: region" : null,
      verdict(
        "10",
        "objection-above-first-surface",
        "A block earlier than the first feature section mentions the reader's own CV or work (the statement)",
        answered,
        `objection at block ${objectionAt}, first surface at block ${firstSurface} (answered above: ${answered})`
      )
    )
  )

  if (want("11")) {
    const facts =
      /\b(cv|proof|role|roles|letter|site|claim|interview|job|jobs)\b/i
    const firsts = SURFACES.map((name) => {
      const block = top.blocks.find(
        (b) => b.region === `surface:${name}` && b.tag === "p"
      )
      return { name, found: Boolean(block), ok: facts.test(block?.text ?? "") }
    })
    out.push(
      verdict(
        "11",
        "product-body-ties-to-hero",
        "Each product's intro paragraph names proof, a CV, a role, a letter, a site, or a claim; a surface with no intro paragraph is off",
        firsts.every((f) => f.ok),
        `missing: ${quote(firsts.filter((f) => !f.ok).map((f) => (f.found ? f.name : `${f.name} (no p)`)))}`
      )
    )
  }

  if (want("12")) {
    const text = top.bodyText
    const logos = /PEOPLE USING OPENCV HAVE INTERVIEWED AT/.test(text)
    const quoteA = /I stopped listing duties/.test(text)
    const quoteB = /treated each one like a pitch/.test(text)
    const invented =
      /[★⭐]|trusted by|as seen in|\b\d[\d,.]*\+?\s?(users|companies|professionals)\b/i.exec(
        text
      )?.[0]
    out.push(
      verdict(
        "12",
        "designed-logos-and-quotes",
        "The logos eyebrow and both design quotes are on the page, with no star rating and no invented user count. Prices are not on /",
        logos && quoteA && quoteB && !invented && !/\$\s?\d/.test(text),
        `logos=${logos} quoteA=${quoteA} quoteB=${quoteB} invented=${invented ?? "none"}`
      )
    )
  }

  const alts = top.imgs.map((i) => i.alt ?? "")
  const personAlt = alts.some((a) => /portrait/i.test(a))
  const cvAlt = alts.some((a) => /\b(cv|letter)\b/i.test(a))
  const placeholder = alts.filter((a) =>
    /placeholder|your name|lorem|untitled/i.test(a)
  ).length
  if (want("13"))
    out.push(
      verdict(
        "13",
        "customer-and-cv-alt",
        "Some image alt names a customer portrait, some alt names a CV or letter, and none says placeholder",
        personAlt && cvAlt && placeholder === 0,
        `person=${personAlt}, cv-or-letter=${cvAlt}, placeholder alts=${placeholder}`
      )
    )
  return out
}

const page = (blocks) => ({
  blocks,
  description: "",
  title: "",
  links: [],
  imgs: [],
  bodyText: "",
})
const failed = (top, id) =>
  textRules(top).find((result) => result.id === id)?.status === "FAIL"
const longHeading =
  "We built a tool that does many different useful things for people every day in the world"
export const badFixture = [
  {
    name: "an H1 over 12 words that names no audience or outcome",
    fails: () =>
      failed(page([{ region: "hero", tag: "h1", text: longHeading }]), "01"),
  },
  {
    name: "marketing words in a block",
    fails: () =>
      failed(
        page([
          { region: "hero", tag: "h1", text: "Get hired" },
          { region: "hero", tag: "p", text: "The best seamless CV tool." },
        ]),
        "04"
      ),
  },
  {
    name: "a hero sentence over 24 words",
    fails: () =>
      failed(
        page([
          { region: "hero", tag: "h1", text: "Get hired" },
          { region: "hero", tag: "p", text: `${"word ".repeat(25).trim()}.` },
        ]),
        "05"
      ),
  },
  {
    name: "a passive hero sentence",
    fails: () =>
      failed(
        page([
          { region: "hero", tag: "h1", text: "Get hired" },
          { region: "hero", tag: "p", text: "Your CV is written for you." },
        ]),
        "05"
      ),
  },
  {
    name: "a statement that never names the product",
    fails: () =>
      failed(page([{ region: "hero", tag: "h1", text: "Get hired" }]), "02"),
  },
  {
    name: "a free-text marketese match",
    fails: () => findMarketese("Supercharge your search").length > 0,
  },
]
