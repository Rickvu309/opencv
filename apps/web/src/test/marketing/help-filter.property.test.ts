import fc from "fast-check"
import { describe, it } from "vitest"

import {
  filterHelpTopics,
  HELP_TOPICS,
  type HelpTopic,
} from "@/features/landing/help/help-copy.ts"

// Rule of filterHelpTopics:
// needle = query.trim().toLowerCase().
// An empty needle returns every topic and every question, in order.
// Otherwise a topic is kept when its title + " " + blurb, lowercased,
// contains the needle (keep every question), or when at least one question's
// question + " " + answer, lowercased, contains the needle (keep only those
// questions, in order). Other topics are dropped. Order follows the input.

const SEED = 449
const NUM_RUNS = 200

type Question = {
  id: string
  question: string
  answer: string
}

type Topic = {
  id: string
  title: string
  blurb: string
  questions: readonly Question[]
}

const queryArb = fc.oneof(
  fc.constant(""),
  fc.constant(" "),
  fc.constant("\n\t"),
  fc.string({ maxLength: 24 })
)

const questionArb: fc.Arbitrary<Question> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  question: fc.string({ maxLength: 24 }),
  answer: fc.string({ maxLength: 24 }),
})

const topicArb: fc.Arbitrary<Topic> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  title: fc.string({ maxLength: 24 }),
  blurb: fc.string({ maxLength: 24 }),
  questions: fc.array(questionArb, { maxLength: 6 }),
})

const topicListArb = fc.array(topicArb, { maxLength: 8 })

function labelOf(topic: Topic): string {
  return `${topic.title} ${topic.blurb}`.toLowerCase()
}

function textOf(item: Question): string {
  return `${item.question} ${item.answer}`.toLowerCase()
}

function sameQuestion(left: Question, right: Question): boolean {
  return (
    left.id === right.id &&
    left.question === right.question &&
    left.answer === right.answer
  )
}

function sameQuestions(
  left: readonly Question[],
  right: readonly Question[]
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index]
      return other !== undefined && sameQuestion(item, other)
    })
  )
}

function sameTopics(left: readonly Topic[], right: readonly Topic[]): boolean {
  return (
    left.length === right.length &&
    left.every((topic, index) => {
      const other = right[index]
      return (
        other !== undefined &&
        topic.id === other.id &&
        topic.title === other.title &&
        topic.blurb === other.blurb &&
        sameQuestions(topic.questions, other.questions)
      )
    })
  )
}

function assertFilterRule(topics: readonly Topic[], query: string): void {
  const result = filterHelpTopics(topics as readonly HelpTopic[], query)
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    if (!sameTopics(result, topics)) {
      throw new Error(
        `blank query ${JSON.stringify(query)} did not return every topic in order`
      )
    }
    return
  }

  const kept = new Set<number>()
  let from = 0
  for (const topic of result) {
    let found = -1
    for (let index = from; index < topics.length; index += 1) {
      const source = topics[index]
      if (
        source &&
        source.id === topic.id &&
        source.title === topic.title &&
        source.blurb === topic.blurb
      ) {
        found = index
        break
      }
    }
    if (found < 0) {
      throw new Error(
        `returned topic ${JSON.stringify(topic.title)} is not a sub-list of the input for ${JSON.stringify(query)}`
      )
    }
    const source = topics[found]
    if (!source) {
      throw new Error(`missing topic at ${found}`)
    }
    const labelHit = labelOf(source).includes(needle)
    const matching = source.questions.filter((item) =>
      textOf(item).includes(needle)
    )
    if (labelHit) {
      if (!sameQuestions(topic.questions, source.questions)) {
        throw new Error(
          `topic ${JSON.stringify(source.title)} matches ${JSON.stringify(query)} in the title but a question was dropped or reordered`
        )
      }
    } else if (!sameQuestions(topic.questions, matching)) {
      throw new Error(
        `topic ${JSON.stringify(source.title)} did not return the matching questions in order for ${JSON.stringify(query)}`
      )
    }
    for (const item of topic.questions) {
      if (!labelHit && !textOf(item).includes(needle)) {
        throw new Error(
          `question ${JSON.stringify(item.question)} does not match ${JSON.stringify(query)}`
        )
      }
    }
    kept.add(found)
    from = found + 1
  }

  for (let index = 0; index < topics.length; index += 1) {
    const source = topics[index]
    if (!source) continue
    const shouldKeep =
      labelOf(source).includes(needle) ||
      source.questions.some((item) => textOf(item).includes(needle))
    if (shouldKeep && !kept.has(index)) {
      throw new Error(
        `dropped topic ${JSON.stringify(source.title)} for query ${JSON.stringify(query)}`
      )
    }
    if (!shouldKeep && kept.has(index)) {
      throw new Error(
        `kept topic ${JSON.stringify(source.title)} that does not match ${JSON.stringify(query)}`
      )
    }
  }
}

const assertOptions = {
  numRuns: NUM_RUNS,
  seed: SEED,
  includeErrorInReport: true,
} as const

describe("filterHelpTopics", () => {
  it("holds for generated topics and queries", () => {
    fc.assert(
      fc.property(topicListArb, queryArb, (topics, query) => {
        assertFilterRule(topics, query)
      }),
      {
        ...assertOptions,
        examples: [
          [[], ""],
          [
            [
              {
                id: "paper",
                title: "Paper",
                blurb: "CVs",
                questions: [{ id: "q", question: "How?", answer: "Write." }],
              },
            ],
            "paper",
          ],
        ],
      }
    )
  })

  it("holds for generated queries against HELP_TOPICS", () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        assertFilterRule(HELP_TOPICS, query)
      }),
      {
        ...assertOptions,
        examples: [["PAPER"], [" "], [""], ["hidden"]],
      }
    )
  })
})
