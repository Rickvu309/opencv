// Writing, logic and proof-markup properties. Each reads the "top" snapshot and returns
// { id, name, rule, pass, measured }. The id is the check number in the landing research,
// section 5. The source of each rule is in the comment above it and in SKILL.md.
const SURFACES = ["Coach", "Paper", "Apply", "Pitch"]
const words = (s) => s.split(/\s+/).filter(Boolean)
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean)
const quote = (list) =>
  list.length ? list.map((s) => `"${s}"`).join(", ") : "none"
const verdict = (id, name, rule, pass, measured) => ({
  id,
  name,
  rule,
  pass,
  measured,
})

const OUTCOME =
  /\b(job|jobs|role|roles|offer|interview|interviews|career|cv|hired|internship)\b/i
const AUDIENCE =
  /\b(student|students|graduate|graduates|grad|grads|intern|interns)\b/i
const STUDENT = /\b(students?|(new|recent|fresh) (graduates?|grads?))\b/i
const MARKETESE =
  /(?<![\w#])#1(?!\w)|(?<!\w)(?:best|dream|seamless|seamlessly|empower\w*|revolutioni[sz]\w*|supercharge\w*|unlock\w*|cutting-edge|world-class|game-chang\w*|next-level)(?!\w)/gi
const ALLOWED = /\byour best work\b/gi
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

export function textRules(top) {
  const h1 = top.blocks.find((b) => b.tag === "h1")?.text ?? ""
  const sub =
    part(top, (r) => r === "hero").find((b) => b.tag === "p")?.text ?? ""
  const subSentences = sentences(sub)
  const out = []

  const outcome = OUTCOME.exec(h1)?.[0]
  const audience = AUDIENCE.exec(h1)?.[0]
  // Shapiro litmus test (julian.com/guide/startup/landing-pages); NN/g 2.2
  out.push(
    verdict(
      "01",
      "h1-length-and-aim",
      "H1 is 12 words or fewer and names the audience or the outcome",
      words(h1).length <= 12 && Boolean(outcome || audience),
      `${words(h1).length} words, outcome=${outcome ?? "none"}, audience=${audience ?? "none"}`
    )
  )

  const heroText = `${h1} ${sub}`
  const vietnamese = /\bvietnamese\b/i.test(heroText)
  const student = STUDENT.test(heroText)
  // NN/g 2.3; Digital.gov plain language
  out.push(
    verdict(
      "02",
      "audience-in-h1-or-subhead",
      'H1 or subhead says "Vietnamese" and "student" or "new graduate"',
      vietnamese && student,
      `vietnamese=${vietnamese}, student-or-graduate=${student}`
    )
  )

  const listItems = Math.max(
    0,
    ...subSentences.map((s) => s.split(/,\s*(?:and\s+)?/).length)
  )
  const defines = /\bis (a|an|the|one)\b|^\w+ is\b/i.test(sub)
  // Shapiro, the subhead expands two thoughts
  out.push(
    verdict(
      "03",
      "subhead-two-beats",
      "Subhead is 1 to 2 sentences, says what the product is, and is not a 3+ item feature list",
      subSentences.length >= 1 &&
        subSentences.length <= 2 &&
        defines &&
        listItems < 3,
      `${subSentences.length} sentence(s), longest list=${listItems} items, defines product=${defines}`
    )
  )

  const copy = [...top.blocks.map((b) => b.text), top.description, top.title]
  const hits = copy.flatMap(findMarketese)
  // Nielsen, marketese (nngroup.com/articles/how-users-read-on-the-web)
  out.push(
    verdict(
      "04",
      "no-marketese",
      'No best, #1, dream, seamless, empower, revolutionize, supercharge (list in text-rules.mjs; only the exact phrase "your best work" is exempt)',
      hits.length === 0,
      `hits: ${quote([...new Set(hits)])}`
    )
  )

  const all = sentenceTexts(top)
  const long = all.filter((s) => words(s.text).length > 20)
  const passive = all.filter((s) => PASSIVE.test(s.text))
  // OPM plain language, 15 to 20 words
  out.push(
    verdict(
      "05",
      "plain-sentences",
      "Hero and surface sentences are 20 words or fewer and not passive (regex heuristic for passive)",
      long.length + passive.length === 0,
      `${all.length} sentences, ${long.length} over 20 words, ${passive.length} passive${passive[0] ? `: ${quote([passive[0].text])}` : ""}`
    )
  )

  const titles = SURFACES.map((name) => {
    const h2 =
      top.blocks.find(
        (b) => b.region === `surface:${name.toLowerCase()}` && b.tag === "h2"
      )?.text ?? ""
    const label =
      top.blocks.some(
        (b) => b.region === `surface:${name.toLowerCase()}` && b.text === name
      ) || h2.includes(name)
    return {
      name,
      h2,
      outcome: words(h2).length >= 3 && h2.trim() !== name,
      label,
    }
  })
  const bad = titles.filter((t) => !(t.outcome && t.label))
  // Shapiro blunt feature headers; NN/g 2.3 jargon
  out.push(
    verdict(
      "06",
      "surface-titles-state-outcome",
      "Each surface title is 3+ words stating an outcome, with the product name kept as a secondary label (heuristic)",
      bad.length === 0,
      bad.length
        ? `title is only a name or lacks the label: ${bad.map((t) => `${t.name}->"${t.h2}"`).join(", ")}`
        : "all four state an outcome"
    )
  )

  const signUps = top.links.filter((l) => l.href === "/sign-up")
  const regions = ["nav", "hero", "closing"]
  const labels = regions.map((r) => ({
    r,
    texts: signUps.filter((l) => l.region === r).map((l) => l.text),
  }))
  const distinct = new Set(labels.flatMap((l) => l.texts))
  // Baymard consistent primary styling; Shapiro
  out.push(
    verdict(
      "07",
      "one-primary-label",
      "One label on the sign-up link in the nav, the hero and the closing band, once in each",
      distinct.size === 1 && labels.every((l) => l.texts.length === 1),
      labels.map((l) => `${l.r}=${quote(l.texts)}`).join(" ")
    )
  )

  const label = [...distinct][0] ?? ""
  // NN/g 4.1; Shapiro "Find food", "Start learning"
  out.push(
    verdict(
      "08",
      "label-has-object",
      "The label is 2+ words and names the next step, not a bare verb such as Start free, Get started, Learn more, Join",
      words(label).length >= 2 && !GENERIC_LABEL.test(label),
      `label ${quote([label])}, ${words(label).length} words, generic=${GENERIC_LABEL.test(label)}`
    )
  )

  const objection =
    /\b(from|built on|based on|uses|using)\s+your\s+(own\s+)?(cv|goals|story)\b/i
  const firstSurface = top.blocks.findIndex((b) =>
    b.region.startsWith("surface:")
  )
  const objectionAt = top.blocks.findIndex(
    (b) => b.region !== "nav" && objection.test(b.text)
  )
  const answered =
    firstSurface > 0 && objectionAt >= 0 && objectionAt < firstSurface
  // Shapiro, answer the objection before the scroll
  out.push(
    verdict(
      "10",
      "objection-above-first-surface",
      "A sentence earlier in the DOM than the first surface section says answers come from the reader's own CV or goals (heuristic)",
      answered,
      `objection at block ${objectionAt}, first surface at block ${firstSurface} (answered above: ${answered})`
    )
  )

  const facts = /first (job|role)|\bcv\b|application|\bjobs?\b|\bpage\b/i
  const firsts = SURFACES.map((name) => {
    const body =
      top.blocks.find(
        (b) => b.region === `surface:${name.toLowerCase()}` && b.tag === "p"
      )?.text ?? ""
    return { name, ok: facts.test(sentences(body)[0] ?? "") }
  })
  // Shapiro, features carry the hero narrative
  out.push(
    verdict(
      "11",
      "surface-first-sentence-ties-to-hero",
      "Each surface's first sentence uses a hero fact: first job, CV, application, job or page (keyword heuristic)",
      firsts.every((f) => f.ok),
      `missing: ${quote(firsts.filter((f) => !f.ok).map((f) => f.name))}`
    )
  )

  const text = top.bodyText
  const proof = {
    price:
      /[$€£₫]\s?\d|\b\d[\d.,]*\s?(usd|eur|vnd|dollars?)\b|\/\s?(mo|month|yr|year)\b|\bper (month|year|seat)\b|\bpricing\b/i.exec(
        text
      )?.[0],
    stars:
      /[★⭐]|\b\d(\.\d)?\s?(\/\s?5|stars?)\b|\bfive-star\b|\brated\b/i.exec(
        text
      )?.[0],
    counts:
      /\b\d[\d,.]*\+?\s?(users|students|graduates|people|interviews|offers|hired|members|companies|professionals|reviews)\b|\bsalary\b|\b\d+\s?%/i.exec(
        text + " " + top.alts.join(" ")
      )?.[0],
    trust: /\b(trusted by|as seen|loved by|join \d)/i.exec(text)?.[0],
  }
  const found = Object.entries(proof)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:"${v}"`)
  const markup = top.markup.blockquote + top.markup.logoImgs
  // FTC endorsement guides; Nielsen on exaggeration
  out.push(
    verdict(
      "12",
      "no-proof-markup",
      "No logo, testimonial, star, price or user-count markup or text (numbers inside screenshots are judged, not read)",
      found.length + markup === 0,
      found.length + markup
        ? `${found.join(" ")} blockquote/logo elements=${markup}`
        : "none found"
    )
  )

  const shot = (name) =>
    top.imgs.find(
      (i) =>
        i.region === `surface:${name}` ||
        (name === "hero" && i.region === "hero")
    )?.alt ?? ""
  const personAlt = [
    shot("hero"),
    ...SURFACES.map((s) => shot(s.toLowerCase())),
  ].find((a) =>
    /student|graduate|new grad|intern|first job|first role/i.test(a)
  )
  const paperAlt = shot("paper")
  const placeholder = top.imgs.filter((i) =>
    /placeholder|your name|lorem|untitled/i.test(i.alt ?? "")
  ).length
  // NN/g 3.2, examples must be representative
  out.push(
    verdict(
      "13",
      "sample-person-alt",
      "Some shot alt names a student or new graduate, the Paper alt names a CV or letter, none says placeholder (alt-text heuristic)",
      Boolean(personAlt) &&
        /\b(cv|letter)\b/i.test(paperAlt) &&
        placeholder === 0,
      `person in alt=${Boolean(personAlt)}, paper alt names CV/letter=${/\b(cv|letter)\b/i.test(paperAlt)}, placeholder alts=${placeholder}`
    )
  )
  return out
}
