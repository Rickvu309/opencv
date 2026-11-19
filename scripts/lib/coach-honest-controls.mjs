export const COACH_HONEST_CONTROL_FILES = Object.freeze([
  "apps/web/src/features/settings/coach-section.tsx",
  "apps/web/src/features/coach/coach-workspace.tsx",
  "apps/web/src/features/coach/coach-context-attachments.tsx",
  "apps/web/src/features/coach/coach-workspace.reducer.ts",
  "apps/web/src/features/coach/coach-tool-line.tsx",
])

const RULES = [
  {
    name: "mobile switch paints its whole tap area",
    pattern:
      /max-md:\[&_\[data-slot=switch-thumb\]\]:data-checked:translate-x-\[26px\]/,
    advice: "Keep the switch track distinct from its 44px tap area.",
  },
  {
    name: "undone record loses its artifact",
    pattern: /if\s*\(part\.undone\)\s*\{\s*return\s*<p\b[^>]*>Undone<\/p>/,
    advice: "Undo must retain the named document record and its Open link.",
  },
  {
    name: "starter leaves focus behind",
    pattern: /onChooseStarter=\{setDraft\}|setDraft\(starter\)/,
    advice:
      "A starter must focus its editable draft with the caret at the end.",
  },
  {
    name: "toggle presented as a row button",
    pattern: /onClick=\{\(\)\s*=>\s*onSave\(\{[^}]*:\s*!profile/,
    advice:
      "a capability toggle saves on a row click and shows only a state word, so it reads as navigation. Use a Switch with checked state.",
  },
  {
    name: "silent context truncation",
    pattern: /\[\s*\.\.\.\s*\w+\s*,\s*item\s*\]\.slice\(\s*0\s*,\s*\d+\s*\)/,
    advice:
      "a new context item past the limit is dropped without a word. Refuse it against ATTACHMENT_LIMIT and show the limit.",
  },
  {
    name: "host-only link label",
    pattern: /label:\s*url\.hostname\b/,
    advice:
      "two links from one site get the same chip. Label links with linkAttachmentLabel.",
  },
  {
    name: "next-message context scope",
    pattern: /context\s+for\s+your\s+next\s+message/i,
    advice:
      "context stays attached after sending, so next-message copy misstates its scope.",
  },
]

export function detect(source, file = "a Coach control file") {
  return RULES.filter((rule) => rule.pattern.test(source)).map(
    (rule) => `${file}: ${rule.name}: ${rule.advice}`
  )
}

const COACH_PANEL = '[data-slot="coach-panel"]'
const TARGETED_STEPS = ["click", "clickIfShown", "waitFor", "fill", "upload"]

export function unscopedPanelTargets(screens) {
  const found = []
  for (const screen of screens) {
    let panelOpen = false
    const steps = [...(screen.steps ?? []), ...(screen.after ?? [])]
    for (const [at, step] of steps.entries()) {
      if (step.goto) panelOpen = false
      const target = TARGETED_STEPS.map((kind) => step[kind]).find(Boolean)
      if (!target) continue
      if (panelOpen && !target.selector)
        found.push(
          `${screen.id} step ${at + 1} ${JSON.stringify(step)}: a bare text or role target while the Coach panel is open can match the page behind it. Use a selector inside ${COACH_PANEL}.`
        )
      if (target.selector === COACH_PANEL) panelOpen = true
    }
  }
  return found
}
