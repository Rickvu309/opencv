import { ArrowUp, Check as CheckIcon, MessageSquarePlus } from "lucide-react"
import { Bar, Text } from "@workspace/stageshow/kit/window.tsx"
import { Button as DrawnButton } from "@workspace/stageshow/kit/controls/Button.tsx"
import { Card } from "@workspace/stageshow/kit/parts/Card.tsx"
import { Check } from "@workspace/stageshow/kit/parts/Check.tsx"
import { Collapse } from "@workspace/stageshow/kit/motion/Collapse.tsx"
import { Draft } from "@workspace/stageshow/kit/controls/Draft.tsx"
import { Field } from "@workspace/stageshow/kit/controls/Field.tsx"
import { Row } from "@workspace/stageshow/kit/parts/Row.tsx"
import { Stage } from "@workspace/stageshow/kit/stage.tsx"
import { Stream } from "@workspace/stageshow/kit/motion/Stream.tsx"
import type { Act } from "@workspace/stageshow/kit/act-api.ts"

import "./coach-scene.css"
import "./phone-scene.css"

const REQUEST = "Tailor my CV for the Lumière role"
const ANSWER =
  "I reworded your existing bullets to lead with results. No experience added."
const WORDS = ANSWER.split(" ").length
const STEPS = [
  "Read Junior Marketing CV",
  "Read the Lumière Cosmetics posting",
  "Drafting bullet rewrites",
]

type Scene = {
  draft: string
  sent: boolean
  completed: number
  phase: "ready" | "working" | "answer" | "proposal"
  words: number
  approval: "ready" | "applying" | "applied"
  resetting: boolean
}

const initial: Scene = {
  draft: "Tailor",
  sent: false,
  completed: 0,
  phase: "ready",
  words: 0,
  approval: "ready",
  resetting: false,
}

const poster: Scene = {
  draft: REQUEST,
  sent: true,
  completed: 3,
  phase: "proposal",
  words: WORDS,
  approval: "applied",
  resetting: false,
}

async function script(a: Act<Scene>) {
  a.mark("type")
  await a.wait(200)
  await a.click({ at: "composer", x: 0.82, y: 0.6 })
  for (
    let letters = initial.draft.length + 1;
    letters <= REQUEST.length;
    letters++
  ) {
    a.put({ draft: REQUEST.slice(0, letters) })
    await a.wait(34)
  }
  await a.wait(250)
  a.mark("send")
  await a.click({ at: "send", x: 0.5, y: 0.5 })
  a.put({ sent: true, phase: "working" })
  await a.move({ x: 306, y: 316 }, { duration: 350 })
  await a.wait(650)
  a.mark("read-cv")
  a.put({ completed: 1 })
  await a.wait(750)
  a.mark("read-job")
  a.put({ completed: 2 })
  await a.wait(850)
  a.mark("rewrites")
  a.put({ completed: 3 })
  await a.wait(350)
  a.mark("answer")
  a.put({ phase: "answer" })
  for (let words = 1; words <= WORDS; words++) {
    a.put({ words })
    await a.wait(65)
  }
  await a.wait(350)
  a.mark("proposal")
  a.put({ phase: "proposal" })
  await a.wait(900)
  a.mark("approve")
  await a.click({ at: "approve", x: 0.87, y: 0.7 })
  a.put({ approval: "applying" })
  await a.wait(450)
  a.mark("applied")
  a.put({ approval: "applied" })
  await a.move({ x: 305, y: 362 }, { duration: 350 })
  await a.wait(2050)
  a.mark("new-chat")
  await a.click({ at: "new-chat", x: 0.5, y: 0.5 })
  a.put({ resetting: true })
  await a.wait(300)
  await a.snap({ ...initial, resetting: true })
  a.put({ resetting: false })
  await a.move({ x: 306, y: 316 }, { duration: 250 })
  await a.wait(150)
}

export function CoachScene() {
  return (
    <Stage
      width={348}
      height={440}
      initial={initial}
      poster={poster}
      script={script}
      play="loop"
      fidelity="standard"
      cursor={{ style: "real", at: { x: 306, y: 316 } }}
      className="look-opencv ocv-coach"
    >
      {(s) => (
        <Card flush pad="small" className="ocv-coach-panel">
          <div className="ocv-coach-header">
            <Text>Coach</Text>
            <DrawnButton
              variant="ghost"
              size="small"
              data-target="new-chat"
              aria-label="New Chat"
              icon={<MessageSquarePlus size={14} />}
            />
          </div>
          <div
            className="ocv-coach-body"
            data-crop
            data-resetting={s.resetting || undefined}
          >
            <div className="ocv-coach-thread" data-crop>
              {[0, 1, 2].map((item) => (
                <div className="ocv-coach-history" key={item}>
                  <Bar
                    w={122 + item * 26}
                    h={28}
                    r={10}
                    tone={1}
                    className="ocv-coach-history-question"
                  />
                  <Bar w={item === 1 ? "92%" : "84%"} h={7} r={3} tone={2} />
                  <Bar w={item === 1 ? "58%" : "66%"} h={7} r={3} tone={2} />
                </div>
              ))}
              <Collapse open={s.sent} reveal="drop" from="below">
                <div className="ocv-coach-question">
                  <Text wrap>{REQUEST}</Text>
                </div>
              </Collapse>
              <Collapse open={s.phase !== "ready"}>
                <div className="ocv-coach-steps">
                  {STEPS.map((step, index) => (
                    <Row
                      key={step}
                      pad={3}
                      lead={
                        <Check
                          on={s.completed > index}
                          pending={s.completed === index}
                          size={12}
                        />
                      }
                      title={<Text>{step}</Text>}
                      className="ocv-coach-step"
                    />
                  ))}
                </div>
              </Collapse>
              <Collapse open={s.phase === "answer" || s.phase === "proposal"}>
                <Stream
                  text={ANSWER}
                  count={s.words}
                  className="ocv-coach-answer"
                />
              </Collapse>
              <Collapse open={s.phase === "proposal"} reveal="drop">
                <Card pad="small" gap={8} className="ocv-coach-proposal">
                  <Text className="ocv-coach-proposal-title">
                    Edit Junior Marketing CV
                  </Text>
                  <div className="ocv-coach-proposal-meta">
                    <Text>3 changes</Text>
                    <DrawnButton
                      variant="ghost"
                      size="small"
                      className="ocv-coach-undo"
                      data-on={s.approval === "applied" || undefined}
                    >
                      Undo
                    </DrawnButton>
                  </div>
                  <DrawnButton
                    variant="primary"
                    size="large"
                    data-target="approve"
                    className="ocv-coach-approve"
                    icon={
                      s.approval === "applied" ? (
                        <CheckIcon size={14} />
                      ) : undefined
                    }
                  >
                    {s.approval === "applied"
                      ? "Applied"
                      : s.approval === "applying"
                        ? "Applying"
                        : "Approve"}
                  </DrawnButton>
                </Card>
              </Collapse>
            </div>
            <div className="ocv-coach-composer-slot">
              <Collapse open={!s.sent}>
                <div className="ocv-coach-compose">
                  <Draft
                    value={s.draft}
                    full={REQUEST}
                    editing
                    placeholder="Ask Coach"
                    data-target="composer"
                    data-cursor="ibeam"
                  />
                  <DrawnButton
                    variant="primary"
                    size="small"
                    data-target="send"
                    aria-label="Send message"
                    icon={<ArrowUp size={14} />}
                    className="ocv-coach-send"
                  />
                </div>
              </Collapse>
              <Collapse open={s.sent}>
                <Field
                  value=""
                  placeholder="Ask Coach"
                  className="ocv-coach-composer"
                />
              </Collapse>
            </div>
          </div>
        </Card>
      )}
    </Stage>
  )
}
