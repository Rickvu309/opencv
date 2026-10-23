import type { ThreadDetail } from "@workspace/domain"

function iso(day: number) {
  return `2026-08-${String(day).padStart(2, "0")}T12:00:00.000Z`
}

function message(
  id: string,
  role: "coach" | "user",
  text: string,
  createdAt: string
) {
  return { id, role, text, createdAt }
}

export const FIXTURE_THREADS: ThreadDetail[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "CV vs internship first",
    createdAt: iso(20),
    updatedAt: iso(25),
    focusDocId: null,
    messages: [
      message(
        "11111111-1111-4111-8111-111111111101",
        "coach",
        "Hey. I'm your OpenCV Coach. Ask anything about direction or your next step.",
        iso(20)
      ),
      message(
        "11111111-1111-4111-8111-111111111102",
        "user",
        "I don't know if I should chase internships or finish my CV first.",
        iso(20)
      ),
      message(
        "11111111-1111-4111-8111-111111111103",
        "coach",
        "Evidence over panic: open Paper when you're ready, or dump what's on your mind here. I haven't changed anything for you.",
        iso(20)
      ),
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Checkout study → Proof",
    createdAt: iso(19),
    updatedAt: iso(24),
    focusDocId: null,
    messages: [
      message(
        "22222222-2222-4222-8222-222222222201",
        "user",
        "Can you turn my checkout study into a Proof in Paper?",
        iso(19)
      ),
      message(
        "22222222-2222-4222-8222-222222222202",
        "coach",
        "I can't write that Proof yet — I haven't edited Paper or run a Command. Open Paper when you want to draft it; we can talk through the story here.",
        iso(19)
      ),
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Is this role a fit?",
    createdAt: iso(18),
    updatedAt: iso(23),
    focusDocId: null,
    messages: [
      message(
        "33333333-3333-4333-8333-333333333301",
        "user",
        "Is this internship a fit, and can you add it to Apply?",
        iso(18)
      ),
      message(
        "33333333-3333-4333-8333-333333333302",
        "coach",
        "I haven't scored Fit or added an Opportunity in Apply. I can help you think it through here until those Commands exist.",
        iso(18)
      ),
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    title: "What should I do this week?",
    createdAt: iso(17),
    updatedAt: iso(22),
    focusDocId: null,
    messages: [
      message(
        "44444444-4444-4444-8444-444444444401",
        "user",
        "What should I do this week?",
        iso(17)
      ),
      message(
        "44444444-4444-4444-8444-444444444402",
        "coach",
        "Pick one concrete move you can finish — I won't pretend I scheduled it or updated Apply for you.",
        iso(17)
      ),
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Talking about my internship",
    createdAt: iso(16),
    updatedAt: iso(21),
    focusDocId: null,
    messages: [
      message(
        "55555555-5555-4555-8555-555555555501",
        "user",
        "How do I talk about my internship without overselling it?",
        iso(16)
      ),
      message(
        "55555555-5555-4555-8555-555555555502",
        "coach",
        "Stick to what you did and what changed. I haven't touched your CV or Pitch.",
        iso(16)
      ),
    ],
  },
]
