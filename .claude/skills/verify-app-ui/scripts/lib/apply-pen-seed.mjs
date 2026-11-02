export const must = (ok, what) => {
  if (!ok) throw new Error(`step did not happen: ${what}`)
}

async function command(page, apiUrl, name, input) {
  const body =
    await page.evaluate(`fetch(${JSON.stringify(`${apiUrl}/api/commands/${name}`)}, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: ${JSON.stringify(input)}, idempotencyKey: crypto.randomUUID() }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }))`)
  must(body.ok, `${name} returned ${body.status}`)
  return body.body?.data?.result ?? body.body?.data ?? body.body
}

const at = (iso) => new Date(iso).toISOString()
const posting = (about, duties, requirements, details) => ({
  about,
  duties: duties.join("\n"),
  requirements: requirements.join("\n"),
  details: details.join("\n"),
})
const JOBS = [
  [
    "Junior Marketing",
    "Lumière Cosmetics",
    "saved",
    "HCMC",
    { deadline: "2026-10-25" },
    { priority: "high" },
  ],
  [
    "UX research intern",
    "Agency",
    "saved",
    "Hanoi",
    { deadline: "2026-11-08" },
    { priority: "normal" },
  ],
  [
    "Business analyst intern",
    "Regional bank",
    "applied",
    "HCMC",
    {},
    { priority: "high" },
  ],
  [
    "Marketing intern",
    "E-commerce co.",
    "applied",
    "Remote",
    {},
    { priority: "low" },
  ],
  [
    "Associate PM intern",
    "Local startup",
    "interview",
    "Hanoi",
    {
      jobUrl: "https://itviec.com/it-jobs/apm-intern",
      sourceHost: "itviec.com",
    },
    {
      priority: "high",
      interviewAt: at("2026-10-29T10:00:00+07:00"),
      recruiterName: "Minh Tran",
      posting: posting(
        "Join a 12-person team building a savings app for students. You will own small features from idea to launch.",
        [
          "Run user interviews and turn notes into clear problems",
          "Write short specs with two engineers",
          "Track what changed after each release",
        ],
        [
          "Final-year student or recent graduate",
          "Clear writing in English and Vietnamese",
          "Curious about how people manage money",
        ],
        [
          "6-month internship, starting January",
          "Hybrid in Hanoi, 3 days in the office",
          "Paid, 6 to 8 million VND a month",
        ]
      ),
    },
  ],
  [
    "Product analyst intern",
    "E-commerce co.",
    "interview",
    "Remote",
    {},
    { priority: "low", interviewAt: at("2026-11-03T14:00:00+07:00") },
  ],
  [
    "Content intern",
    "Agency",
    "closed",
    "Hanoi",
    {
      jobUrl: "https://topcv.vn/viec-lam/content-intern",
      sourceHost: "topcv.vn",
    },
    {
      priority: "low",
      recruiterName: "Lan Pham",
      posting: posting(
        "Write for agency clients in beauty and food, from blog posts to social captions.",
        [
          "Draft two blog posts a week",
          "Write captions for client social channels",
          "Join client calls and take notes",
        ],
        [
          "Strong writing in Vietnamese",
          "A few published samples",
          "Comfortable with short deadlines",
        ],
        [
          "4-month internship",
          "On site in Hanoi",
          "Paid, 5 million VND a month",
        ]
      ),
    },
  ],
]

export async function seed(page, apiUrl) {
  const ids = {}
  const run = (name, input) => command(page, apiUrl, name, input)
  for (const [title, company, stage, location, create, patch] of JOBS) {
    const made = await run("job.create", {
      title,
      company,
      location,
      stage: stage === "closed" ? "saved" : stage,
      ...create,
    })
    ids[title] = made.id
    await run("job.update", { jobId: made.id, patch })
    if (stage === "closed")
      await run("job.move", { jobId: made.id, stage: "closed" })
  }
  const apm = ids["Associate PM intern"]
  const steps = []
  for (const label of [
    "Read about their savings app",
    "Practise three PM questions",
    "Bring the checkout study",
  ])
    steps.push(await run("job.addChecklistItem", { jobId: apm, label }))
  await run("job.setChecklistItem", {
    jobId: apm,
    itemId: steps[0].id,
    done: true,
  })
  const cv = await run("paper.create", {
    kind: "cv",
    name: "Junior Marketing CV",
    jobId: apm,
  })
  await run("job.linkPaper", {
    jobId: ids["Content intern"],
    docId: cv.id,
    kind: "cv",
  })
  await run("job.addNote", {
    jobId: ids["Content intern"],
    body: "What I learned: the writing test went well. Next time, bring a sharper story with numbers.",
  })
  await run("paper.create", {
    kind: "letter",
    name: "Cover letter, Local startup",
  })
  const ready = await run("paper.create", {
    kind: "letter",
    name: "Cover letter, Lumière",
  })
  await run("paper.setStatus", { docId: ready.id, status: "ready" })
  await run("job.addNote", {
    jobId: apm,
    body: "Minh likes concrete numbers. Bring the checkout study.",
  })
  return ids
}
