export const COACH_HONEST_CONTROL_FILES = Object.freeze([
  "apps/web/src/features/settings/coach-section.tsx",
  "apps/web/src/features/coach/coach-workspace.tsx",
  "apps/web/src/features/coach/coach-context-attachments.tsx",
  "apps/web/src/features/coach/coach-workspace.reducer.ts",
  "apps/web/src/features/coach/coach-tool-line.tsx",
  "scripts/ui/screens.mjs",
])

const RULES = [
  {
    name: "mobile switch paints its whole tap area",
    pattern:
      /max-md:\[&_\[data-slot=switch-thumb\]\]:data-checked:translate-x-\[26px\]/,
    advice: "Keep the switch track distinct from its 44px tap area.",
  },
  {
    name: "Coach approval capture can hit the background Paper action",
    pattern: /click:\s*\{\s*role:\s*"button",\s*name:\s*"Approve"\s*\}/,
    advice: "Scope the Coach approval action to its panel.",
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
