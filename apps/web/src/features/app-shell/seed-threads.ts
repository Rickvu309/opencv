export type SearchThread = {
  id: string
  title: string
  when: string
  preview?: string
}

/** Seed Threads for Search (and later History). Client-only; Spec 3.5 persists. */
export const SEED_THREADS: SearchThread[] = [
  {
    id: "t1",
    title: "CV vs internship first",
    when: "5 minutes ago",
    preview: "Evidence over panic: open Paper and pick one Proof to add first.",
  },
  {
    id: "t2",
    title: "Checkout study → Proof",
    when: "Yesterday",
    preview: "Turn the card resize test into a Proof Coach can cite later.",
  },
  {
    id: "t3",
    title: "Is this role a fit?",
    when: "Mon",
    preview: "Look at the JD gaps against your Profile before you apply.",
  },
]
