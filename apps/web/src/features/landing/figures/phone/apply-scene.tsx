import { Bar, Text } from "@workspace/stageshow/kit/window.tsx"
import { Button as DrawnButton } from "@workspace/stageshow/kit/controls/Button.tsx"
import { Card } from "@workspace/stageshow/kit/parts/Card.tsx"
import { Check } from "@workspace/stageshow/kit/parts/Check.tsx"
import { Collapse } from "@workspace/stageshow/kit/motion/Collapse.tsx"
import { Count } from "@workspace/stageshow/kit/motion/Count.tsx"
import { Field } from "@workspace/stageshow/kit/controls/Field.tsx"
import { Row } from "@workspace/stageshow/kit/parts/Row.tsx"
import { Stage } from "@workspace/stageshow/kit/stage.tsx"
import type { Act } from "@workspace/stageshow/kit/act-api.ts"
import { CalendarDays } from "lucide-react"

import "./apply-scene.css"
import "./phone-scene.css"

type Scene = {
  link: string
  focused: boolean
  phase: "ready" | "saving" | "saved"
  added: boolean
  count: number
}

const LINK = "careers.lumiere.vn/jobs/marketing-intern"
const initial: Scene = {
  link: "",
  focused: false,
  phase: "ready",
  added: false,
  count: 3,
}
const poster: Scene = {
  link: LINK,
  focused: false,
  phase: "saved",
  added: true,
  count: 4,
}

async function script(a: Act<Scene>) {
  a.mark("opening")
  await a.wait(850)
  await a.move({ at: "job-link", x: 0.82, y: 0.55 }, { duration: 650 })
  await a.click()
  await a.set({ focused: true })
  await a.wait(300)
  a.mark("paste")
  await a.key("cmd+v")
  await a.set({ link: LINK })
  await a.wait(1000)
  await a.move({ at: "save-job", x: 0.86, y: 0.6 }, { duration: 650 })
  await a.click()
  await a.set({ phase: "saving", focused: false })
  a.mark("pending")
  await a.wait(950)
  await a.set({ phase: "saved", added: true })
  a.mark("arrival")
  await a.move({ at: "saved-heading", x: 0.6, y: 2.4 }, { duration: 600 })
  await a.wait(150)
  await a.set({ count: 4 })
  await a.wait(650)
  a.mark("payoff")
  await a.wait(2200)
  await a.move({ at: "undo-save", x: 0.84, y: 0.55 }, { duration: 650 })
  await a.wait(200)
  await a.click()
  await a.set({ added: false, count: 3 })
  a.mark("undo")
  await a.wait(750)
  await a.set({ phase: "ready", link: "" })
  await a.move({ at: "job-link", x: 0.86, y: 1.8 }, { duration: 600 })
  await a.wait(450)
}

const filler = [
  { title: 124, company: 91, event: 35 },
  { title: 148, company: 110, event: 42 },
  { title: 112, company: 83, event: 32 },
]

export function ApplyScene() {
  return (
    <Stage<Scene>
      width={348}
      height={420}
      initial={initial}
      poster={poster}
      script={script}
      play="loop"
      fidelity="standard"
      cursor={{ style: "real", at: { at: "job-link", x: 0.86, y: 1.8 } }}
      keys="top"
      className="look-opencv opencv-apply"
    >
      {(s) => (
        <Card className="oa-panel" gap={0}>
          <div className="oa-add">
            <Field
              value={s.link}
              focused={s.focused}
              placeholder="Paste a job link"
              className="oa-link"
              box={{ "data-target": "job-link", "data-cursor": "ibeam" }}
            />
            <DrawnButton
              variant="primary"
              size="large"
              data-target="save-job"
              className="oa-save"
              icon={
                s.phase === "ready" ? undefined : (
                  <Check
                    size={14}
                    pending={s.phase === "saving"}
                    on={s.phase === "saved"}
                  />
                )
              }
            >
              {s.phase === "saving"
                ? "Saving"
                : s.phase === "saved"
                  ? "Saved"
                  : "Save"}
            </DrawnButton>
          </div>
          <div className="oa-heading" data-target="saved-heading">
            <div className="oa-group">
              <Text className="oa-title">Saved</Text>
              <Count value={s.count} className="oa-count" />
            </div>
            <div className="oa-undo" data-visible={s.added || undefined}>
              <DrawnButton variant="ghost" size="small" data-target="undo-save">
                Undo
              </DrawnButton>
            </div>
          </div>
          <div className="oa-list">
            <Collapse open={s.added} reveal="drop">
              <Row
                className="oa-job"
                title={<Text>Marketing intern</Text>}
                subtitle={<Text>Lumière Cosmetics</Text>}
                meta={
                  <span className="oa-event">
                    <CalendarDays size={12} strokeWidth={1.75} />
                    <Text>Oct 25</Text>
                  </span>
                }
              />
            </Collapse>
            {filler.map((job, index) => (
              <Row
                key={index}
                className="oa-job"
                title={<Bar w={job.title} h={6} tone={2} />}
                subtitle={<Bar w={job.company} h={5} tone={1} />}
                meta={<Bar w={job.event} h={5} tone={1} />}
              />
            ))}
          </div>
          <div className="oa-continuation">
            <Bar w={53} h={6} tone={2} />
            <Bar w={164} h={5} tone={1} />
          </div>
        </Card>
      )}
    </Stage>
  )
}
