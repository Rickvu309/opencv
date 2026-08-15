# What My Paper motion is for

Type: grilling
Status: resolved
Blocked by: 03, 05

## Question

Which My Paper transitions earn motion, and which must stay instant?

## Answer

Locked 15 Aug 2026. Spec: [Motion](../spec.md#motion). Values from `/animate` on **this repo’s tokens** — no new millisecond numbers. `DESIGN.md` Layout-animation ban (accordion only) is superseded **for block reorder on the A4**; siblings move with `transform`, not width/height.

No CSS shipped.

### Instant (100+/day or tens/day)

| What | Why |
| --- | --- |
| Caret, typing, Tab, Shift-Tab, arrows | 100+/day. `/animate` gate. |
| Hover colour / hairline | Instant-Hover Rule. |
| Keyboard Back / Enter on the gallery | Keyboard: no Enter / Exit. |
| Page break / scroll | The page is the work. Don’t animate the paper jumping. |
| No-origin land (Application, Coach, New → Proof) | Nothing to travel from. Cut. |
| `prefers-reduced-motion` | Skip all **Translate / Scale** travel. Instant land. **Fade** only if a fade was already the motion (other gallery tiles). |

### Occasional — spatial

| What | Purpose | Term | Tool | Tokens |
| --- | --- | --- | --- | --- |
| Drive row → Docs (and reverse) | Spatial consistency | **Shared element transition** (name→title, slab→sheet) + **Fade out** of the rest | View transition / WAAPI; `transform` + opacity | Enter `--duration-surface` + `--ease-enter`. Exit `--ease-exit` (faster). Scale never below 0.93. |
| Gallery tile → A4 | Spatial consistency | Same **Shared element**; other tiles **Fade out** | Same | Same. Reduced motion: skip travel. |
| Add CV block / add proof | Preventing a jarring change | **Reveal** | CSS transition, opacity + `translateY` a few px | `--duration-surface` + `--ease-enter` (occasional, not the 500ms rare Reveal) |
| Reorder a block | Spatial consistency | **Layout animation** of siblings | `transform: translate` on siblings (not height) | `--duration-surface` + `--ease-enter` until `DESIGN.md` grows an on-screen move curve |

### Rare

| What | Purpose | Term | Tokens |
| --- | --- | --- | --- |
| Empty room → first sheet-edge row | State indication | **Reveal** of the first row in the same room | `--duration-reveal` + `--ease-enter`. Once. |
| Upload scan | Explanation | **Reveal** | **Forbidden** until extract is real ([Upload as a starting point](11-upload-as-a-starting-point.md)). |

### Not motion

No load **Orchestration**. No **Stagger** of Drive rows. No **Float** on the A4. No scan theater. No caret animation. Arrange/Publish is a Docs beat, not a page-transition show.

### Gate

| Frequency | Decision |
| --- | --- |
| 100+/day | Instant |
| Tens/day | Instant colour; or 120ms fade (`--duration-press`) |
| Occasional | 300ms surface |
| Rare | 500ms reveal, once |
