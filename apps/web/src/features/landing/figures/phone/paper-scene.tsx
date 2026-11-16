import { ArrowRight, Bold, Check, Italic, List, Undo2 } from "lucide-react"
import { Bar } from "@workspace/stageshow/kit/window.tsx"
import { Button } from "@workspace/stageshow/kit/controls/Button.tsx"
import { Popover } from "@workspace/stageshow/kit/motion/Popover.tsx"
import { Roll } from "@workspace/stageshow/kit/motion/Roll.tsx"
import { Stage } from "@workspace/stageshow/kit/stage.tsx"
import type { Act } from "@workspace/stageshow/kit/act-api.ts"

import "./paper-scene.css"
import "./phone-scene.css"

type PaperState = { kind: "suggested" | "accepted" | "fitted" }

const initial: PaperState = { kind: "suggested" }
const poster: PaperState = { kind: "fitted" }
const rest = { x: 309, y: 262 }

async function script(a: Act<PaperState>) {
  a.mark("suggestion")
  await a.wait(1300)
  await a.move({ at: "accept", x: 0.88, y: 0.82 }, { duration: 900 })
  await a.wait(400)
  a.mark("accept-press")
  await a.click({ at: "accept", x: 0.88, y: 0.82 })
  a.set({ kind: "accepted" })
  a.mark("accepted")
  await a.wait(700)
  a.set({ kind: "fitted" })
  a.mark("fits-one-page")
  await a.move(rest, { duration: 550 })
  await a.wait(2300)
  await a.move({ at: "undo", x: 0.88, y: 0.82 }, { duration: 1000 })
  await a.wait(400)
  a.mark("undo-press")
  await a.click({ at: "undo", x: 0.88, y: 0.82 })
  a.set({ kind: "suggested" })
  a.mark("undone")
  await a.wait(700)
  await a.move(rest, { duration: 650 })
  await a.wait(200)
}

export function PaperScene() {
  return (
    <Stage<PaperState>
      width={348}
      height={420}
      initial={initial}
      poster={poster}
      script={script}
      play="loop"
      fidelity="standard"
      cursor={{ style: "real", at: rest }}
      className="look-opencv opencv-paper"
    >
      {(s, rect) => {
        const accepted = s.kind !== "suggested"
        const bullet = rect("paper-bullet")
        const sheet = rect("paper-sheet")
        return (
          <>
            <div className="paper-editor">
              <div className="paper-toolbar">
                <div className="paper-tools">
                  <Bold size={14} strokeWidth={1.7} />
                  <Italic size={14} strokeWidth={1.7} />
                  <span className="paper-tool-rule" />
                  <List size={14} strokeWidth={1.7} />
                </div>
                <div
                  className="paper-fit"
                  data-show={s.kind === "fitted" || undefined}
                >
                  <Check size={14} strokeWidth={1.7} />
                  <span>Fits one page</span>
                </div>
              </div>
              <div className="paper-ruler" aria-hidden="true" />
              <div className="paper-sheet" data-target="paper-sheet">
                <div className="paper-name">Minh Tran</div>
                <div className="paper-contact" aria-hidden="true">
                  <Bar w={72} h={3} tone={2} />
                  <Bar w={49} h={3} tone={2} />
                  <Bar w={35} h={3} tone={2} />
                </div>
                <div className="paper-section">EXPERIENCE</div>
                <div className="paper-role">Marketing Intern, Lumière</div>
                <div
                  className="paper-bullet"
                  data-target="paper-bullet"
                  data-cursor="ibeam"
                >
                  <span className="paper-bullet-mark">•</span>
                  <div className="paper-bullet-words">
                    <div className="paper-bullet-line">
                      <span
                        className="paper-edit"
                        data-accepted={accepted || undefined}
                      >
                        <Roll>{accepted ? "Wrote" : "Responsible for"}</Roll>
                      </span>
                      <span> weekly TikTok scripts;</span>
                    </div>
                    <div>three passed 100k views.</div>
                  </div>
                </div>
                <div className="paper-filler" aria-hidden="true">
                  <Bar w="95%" h={4} tone={1} />
                  <Bar w="78%" h={4} tone={1} />
                  <Bar w="89%" h={4} tone={1} />
                </div>
                <div className="paper-bottom-filler" aria-hidden="true">
                  <Bar w={74} h={5} tone={2} />
                  <Bar w="93%" h={4} tone={1} />
                  <Bar w="88%" h={4} tone={1} />
                  <Bar w="62%" h={4} tone={1} />
                </div>
              </div>
            </div>
            <Popover
              show
              className="paper-suggestion"
              style={{ left: sheet.x + 12, top: bullet.y + bullet.height + 14 }}
              data-target="suggestion"
            >
              <div className="paper-coach">Coach</div>
              <div className="paper-diff">
                <span className="paper-before">Responsible for</span>
                <ArrowRight size={14} strokeWidth={1.7} />
                <span className="paper-after">Wrote</span>
              </div>
              <div className="paper-actions">
                <Button
                  variant="primary"
                  size="medium"
                  data-target="accept"
                  icon={
                    accepted ? <Check size={14} strokeWidth={1.7} /> : undefined
                  }
                >
                  {accepted ? "Accepted" : "Accept"}
                </Button>
                <Button
                  variant="ghost"
                  size="medium"
                  data-target="undo"
                  icon={
                    accepted ? <Undo2 size={14} strokeWidth={1.7} /> : undefined
                  }
                >
                  {accepted ? "Undo" : "Reject"}
                </Button>
              </div>
            </Popover>
          </>
        )
      }}
    </Stage>
  )
}
