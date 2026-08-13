# Agent-native OpenPath, Coach on Eve

Technical specification for embedding the Coach as a first-class agent inside the
existing OpenPath web app, using [Eve](https://eve.dev) (Vercel's filesystem-first
agent framework).

**Status:** built and shipped. This document is the original design record and is
**no longer current in two respects**: the provider is now OpenRouter
(`OPENROUTER_API_KEY`, model `deepseek/deepseek-v4-flash-0731`, overridable via
`OPENPATH_MODEL`) rather than build.nvidia.com direct, and the `lib/data.ts`
seed persona it refers to has been deleted. Read `agent/agent.ts`, `DESIGN.md`
and the action registry for what is actually true; keep this for the reasoning
behind the shape.
**Scope:** replaces `components/coach/replies.ts` (canned replies) with a real agent.
No visual redesign; every surface built so far stays exactly as it is.

---

## 1. Why Eve, and what changes

Today the Coach is a `switch` statement. `pickReply()` matches a keyword and returns a
hard-coded string after a 1200 ms fake delay. Everything else about the Coach, the
thread UI, the dock, the composer, the suggestion cards, the `?q=` handoffs, is real
and worth keeping.

Eve replaces exactly one layer: **the thing that decides what the Coach says.**

| Concern | Today | With Eve |
|---|---|---|
| Reply generation | `replies.ts` keyword match | Model turn against real context |
| Coach's knowledge | none | `agent/instructions.md` + tools |
| Per-surface behaviour | none | `agent/skills/*` loaded on demand |
| Reacting to what the user did | none | app signals → agent nudges |
| Conversation memory | React state, lost on reload | Durable sessions + `defineState` |
| Writing back into the app | hard-coded `suggestion` on one seed message | `propose_change` tool |

What we get that we cannot get by calling a chat API directly:

- **Durable sessions.** Every turn is a checkpointed workflow step. A session survives
  reload, crash, and redeploy. Our thread state stops being a React array that dies on
  refresh.
- **Filesystem-first capabilities.** A new coaching behaviour is a new markdown file, not
  a new branch in a prompt-assembly function. This is the property that keeps the
  codebase lean as the Coach grows.
- **One deployment.** `npx eve init .` adds to this repo; it ships to Vercel alongside
  the Next.js app.

**Non-goals.** Not a rewrite of the UI. Not a general-purpose agent. Not a replacement
for `lib/data.ts`, the mock data layer stays until there is a real backend.

---

## 2. Architecture

```
┌─────────────────────────────── Next.js app (existing) ───────────────────────────────┐
│                                                                                       │
│  /coach            /profile           /career-map           /todo        /plan        │
│  full thread       vault + ring       path diagram          list         phases       │
│      │                  │                   │                 │            │          │
│      │                  └──────── app events (signals) ───────┴────────────┘          │
│      │                                      │                                         │
│  components/coach/                          │                                         │
│   ├── thread.tsx    ← useCoachThread (unchanged public shape)                         │
│   ├── composer.tsx                          │                                         │
│   ├── coach-dock.tsx ← renders nudges       │                                         │
│   └── client.ts     ← NEW: Eve client       │                                         │
└─────────────────────┬───────────────────────┬─────────────────────────────────────────┘
                      │ POST /message         │ POST /signal
                      │ GET  /stream          │
┌─────────────────────▼───────────────────────▼─────────────────────────────────────────┐
│ agent/                                                    Eve durable service          │
│  ├── agent.ts            model: NVIDIA (OpenAI-compatible)                             │
│  ├── instructions.md     who the Coach is                                              │
│  ├── channels/web.ts     the only entry point our app uses                             │
│  ├── tools/              read context · propose changes                                │
│  ├── skills/             per-surface coaching procedures (load-on-demand)              │
│  ├── hooks/              observe the runtime stream (telemetry, nudge capture)          │
│  ├── schedules/          weekly check-in                                                │
│  └── lib/                shared types + state slots                                     │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**One channel, two verbs.** The app never talks to the model. It sends *messages*
(the user typed something) or *signals* (the user did something). Everything else is the
agent's business.

---

## 3. Installation

> **Blocker, Node version.** Eve requires **Node 24+**. This machine currently runs
> **v22.17.1**, and `package.json` declares no `engines` field. Upgrade before Phase 1:
> ```bash
> nvm install 24 && nvm use 24
> ```
> and pin it so Vercel builds match:
> ```json
> "engines": { "node": ">=24" }
> ```
> Next.js 16 supports Node 24, so this does not affect the existing app.

```bash
npx eve@latest init .          # adds agent/ to this repo
npm install @ai-sdk/openai-compatible
```

Credentials, `.env.local`, never committed:

```bash
NVIDIA_API_KEY=nvapi-...       # from build.nvidia.com
```

Local dev runs the agent beside the app:

```bash
npm run dev
```

---

## 4. Model configuration (build.nvidia.com)

NVIDIA's hosted endpoint is OpenAI-compatible, so it wires in as an AI SDK provider.
Eve accepts either a gateway model string or a provider instance.

```ts
// agent/agent.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const nvidia = createOpenAICompatible({
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

export default defineAgent({
  model: nvidia("meta/llama-3.3-70b-instruct"),
  reasoning: "low",
  limits: {
    // A coaching turn is short. Cap hard so a runaway loop cannot bill us.
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 12_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
  compaction: { thresholdPercent: 0.75 },
});
```

### Measured results, build.nvidia.com, 2026-08-04

Phase 1 is installed and the pipeline is **verified end-to-end**: session created,
170 stream events, `message.completed` received. The open problem is not integration;
it is that no model on this key is currently good *and* fast enough.

| Model | Latency (in eve) | Vietnamese | Verdict |
|---|---|---|---|
| `deepseek-ai/deepseek-v4-pro` | ~150 s | correct, warm mentor register | **current default**, right, but slow |
| `mistralai/mistral-nemotron` | ~4 s | breaks under the harness; leaked Russian | rejected |
| `deepseek-ai/deepseek-v4-flash` |, |, | 529 Overloaded, 3 retries |
| `meta/llama-3.3-70b-instruct` | timeout |, | hangs, no events |
| `nvidia/llama-3.3-nemotron-super-49b` | 17 s |, | reasoning-only, `content: null` |

Two findings worth carrying forward:

1. **The `/v1/models` catalog lists dead models.** `llama-4-maverick`, `gemma-3-27b`,
   `phi-4-multimodal` all return `410 Gone` (end-of-life). Probe before trusting the list.
2. **Eve's harness degrades small models.** `mistral-nemotron` produced clean Vietnamese
   on a direct API call and incoherent Vietnamese through eve, the difference is the
   long English harness prompt. Hardening the instructions made it *worse*. Model
   capability, not prompt tuning, is the fix.

**Model choice is a config line, not an architecture decision**, `agent/agent.ts:28`.
The recommended resolution is a stronger provider (AI Gateway, Anthropic, or OpenAI
direct), which is a one-line change and would close both the latency and quality gaps at
once.

---

## 5. The Coach's identity

`agent/instructions.md` is the permanent system prompt. It holds only what never
changes, identity, voice, hard rules. Situational procedure belongs in skills.

```md
Bạn là Coach của OpenPath, người đồng hành nghề nghiệp cho sinh viên và người mới
đi làm ở Việt Nam.

## Giọng điệu
- Nói tiếng Việt tự nhiên, xưng "mình", gọi người dùng là "bạn".
- Như một người anh/chị đi trước: khích lệ nhưng không tâng bốc.
- Ngắn. Ba đoạn là nhiều. Không bao giờ dùng emoji quá một lần mỗi hội thoại.

## Nguyên tắc
1. **Bằng chứng trước lời khuyên.** Mọi nhận định phải dựa trên hồ sơ thật của người
   dùng hoặc số liệu thị trường. Nếu chưa có dữ liệu, hỏi, đừng đoán.
2. **Luôn có bước tiếp theo.** Kết thúc bằng một việc cụ thể làm được trong tuần này.
3. **Trung thực về khoảng cách.** Nếu còn xa mục tiêu, nói thẳng kèm thời gian ước tính.
4. **Không hứa thay nhà tuyển dụng.** Không cam kết lương, không cam kết đậu phỏng vấn.

## Ranh giới
- Không tư vấn pháp lý, y tế, tài chính cá nhân.
- Khi người dùng hỏi ngoài phạm vi nghề nghiệp, trả lời ngắn rồi kéo về hướng đi của họ.
```

---

## 6. Capabilities

### 6.1 Tools, what the Coach can do

Filename is the tool name. Keep each tool one verb wide.

```
agent/tools/
├── get_profile.ts        đọc hồ sơ hiện tại (vault, kỹ năng, bối cảnh)
├── get_plan.ts           đọc kế hoạch + việc đang mở
├── get_paths.ts          đọc sơ đồ hướng đi và mục tiêu đang đặt
└── propose_change.ts     đề xuất một thay đổi để người dùng duyệt
```

`propose_change` is the important one; it is how the Coach writes back into the app
**without ever mutating state directly.** It returns a proposal; the client renders it as
the `SuggestionCard` that already exists in `thread.tsx`; the user accepts or dismisses.

```ts
// agent/tools/propose_change.ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Đề xuất một thay đổi cụ thể trong app cho người dùng duyệt: thêm hướng đi, " +
    "đổi mục tiêu, thêm việc vào Todo, hoặc ghim kỹ năng vào kế hoạch. " +
    "Chỉ dùng khi đề xuất đủ cụ thể để bấm một nút là xong.",
  inputSchema: z.object({
    kind: z.enum(["add-path", "adjust-map", "add-todo", "set-target"]),
    label: z.string().min(1).describe("Câu mô tả hành động, hiện trên thẻ đề xuất"),
    payload: z.record(z.string()).describe("Dữ liệu tối thiểu để app thực hiện"),
    reason: z.string().describe("Vì sao đề xuất, hiện khi người dùng hỏi lại"),
  }),
  async execute(proposal) {
    // Agent không tự đổi state. Trả về đề xuất; client render thành SuggestionCard.
    return { proposed: true, ...proposal };
  },
});
```

The read tools take the same shape and, for now, read the same mock module the UI reads
(`lib/data.ts`) via `agent/lib/context.ts`. When a real backend lands, only that one file
changes; every tool and skill above it is untouched. That is the seam.

### 6.2 Skills, per-surface coaching procedures

A skill is a markdown file. Eve exposes each description to the model and appends the
body to context only when it is actually needed, so adding the twentieth skill costs
nothing on the other nineteen turns. **This is the modularity guarantee that keeps the
Coach from becoming one giant prompt.**

```
agent/skills/
├── review-cv.md          description: Dùng khi người dùng nhờ xem lại CV.
├── compare-paths.md      description: Dùng khi người dùng phân vân giữa hai hướng đi.
├── plan-next-weeks.md    description: Dùng khi người dùng hỏi nên ưu tiên gì.
├── gap-to-role.md        description: Dùng khi người dùng hỏi cần gì để tới một vai trò.
└── market-check.md       description: Dùng khi người dùng hỏi về thị trường tuyển dụng.
```

Example:

```md
---
description: Dùng khi người dùng nhờ xem lại CV hoặc mô tả kinh nghiệm.
---

Đọc CV qua `get_profile` trước khi nhận xét. Với mỗi mục kinh nghiệm, hỏi ba câu:

1. Có số liệu không? "Làm báo cáo tuần" → "báo cáo tuần cho chiến dịch ngân sách 200tr".
2. Có kết quả không? Việc đã làm ≠ thứ đã thay đổi nhờ việc đó.
3. Có đúng hướng không? Mô tả phải nghiêng về vai trò người dùng đang nhắm.

Đưa tối đa ba nhận xét, mỗi nhận xét kèm một câu viết lại cụ thể.
Không viết hộ cả CV, người dùng phải giữ giọng của họ.
```

**Rule: one skill = one thing the user might ask for.** If a skill's description needs
"và", it is two skills.

### 6.3 The reactive layer, signals

This is the part that makes the Coach feel present rather than summoned, and it is worth
being precise about, because the obvious answer is wrong.

**Eve hooks subscribe to the *agent's* runtime stream** (`session.started`,
`message.completed`, `action.result`); not to our app's UI events. A hook cannot observe
"the user dragged a node on the career map". So the bridge is explicit:

```
user does something in the app
        │
        ▼
POST /signal   { type, payload, route }        ← debounced in the client
        │
        ▼
channel maps signal → a short internal message
        │
        ▼
agent turn, forced to structured output { speak: boolean, text?, proposal? }
        │
        ▼
speak: false → nothing renders (the common case)
speak: true  → coach-dock shows a nudge
```

Signals we emit, and what the Coach might say:

| Signal | Emitted from | Coach may respond with |
|---|---|---|
| `vault.item_added` | `/profile` | what this unlocks; the next gap |
| `todo.completed` | `/todo` | acknowledge streak; what it unblocks |
| `path.target_set` | `/career-map` | what changes in the plan now |
| `path.node_added` | `/career-map` | honest read on a self-added role |
| `profile.section_saved` | `/profile` | whether the new detail changes the advice |

**Silence is the default.** The agent is instructed to return `speak: false` unless it has
something specific and non-obvious. A Coach that comments on every click is noise, and
noise is what makes users turn assistants off. This is enforced in the channel's
instructions, capped by rate limit (§8), and measured in evals (§10).

### 6.4 Hooks, observation, not reaction

Hooks do what they are actually for: side effects on durably-recorded events.

```ts
// agent/hooks/telemetry.ts
import { defineHook } from "eve/hooks";

export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      console.info("coach.session", { sessionId: ctx.session.id });
    },
    async "message.completed"(event, ctx) {
      console.info("coach.reply", {
        sessionId: ctx.session.id,
        chars: event.data.message?.length ?? 0,
      });
    },
  },
});
```

Used for: turn latency, reply length distribution, tool-call frequency, nudge
speak-rate. All of which we need to tune §6.3 with evidence instead of vibes.

### 6.5 State, what the Coach remembers within a session

```ts
// agent/lib/state.ts
import { defineState } from "eve/context";

/** Chống làm phiền: đã nhắc gì, nhắc lúc nào. */
export const nudges = defineState("openpath.nudges", () => ({
  lastAt: 0,
  count: 0,
  saidTypes: [] as string[],
}));

/** Bối cảnh người dùng gửi kèm mỗi lượt, để tool đọc lại không cần hỏi lại. */
export const userContext = defineState("openpath.context", () => ({
  route: "/coach",
  targetRole: "",
  completeness: 0,
}));
```

State survives step boundaries, crashes, and redeploys, so "mình đã nhắc bạn việc này
hôm qua rồi" is actually true, not a guess.

### 6.6 Schedules, the weekly check-in

```ts
// agent/schedules/weekly-checkin.ts
import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  // 8:00 sáng thứ Hai (UTC+7 → 01:00 UTC)
  cron: "0 1 * * 1",
  markdown:
    "Xem tiến độ kế hoạch tuần vừa rồi. Nếu có việc đã xong, ghi nhận cụ thể. " +
    "Nếu không có tiến triển nào, hỏi một câu ngắn xem vướng ở đâu, không trách móc. " +
    "Kết thúc bằng đúng một việc cho tuần này.",
});
```

This is the retention mechanism the PRD asks for (WAU/MAU, 7/30-day retention), expressed
as four lines of config.

---

## 7. The channel; our only entry point

```ts
// agent/channels/web.ts
import { defineChannel, GET, POST } from "eve/channels";

export default defineChannel({
  routes: [
    // Người dùng gõ trong Composer.
    POST("/message", async (req, { send }) => {
      const { text, context, token } = await req.json();
      const session = await send(text, {
        auth: null,
        continuationToken: token ?? "web:anon",
        state: { context },
      });
      return Response.json({ sessionId: session.id });
    }),

    // Người dùng vừa làm gì đó trong app.
    POST("/signal", async (req, { send }) => {
      const { type, payload, context, token } = await req.json();
      const session = await send(
        `[SIGNAL] ${type} ${JSON.stringify(payload)}`,
        { auth: null, continuationToken: token ?? "web:anon", state: { context } },
      );
      return Response.json({ sessionId: session.id });
    }),

    GET("/sessions/:sessionId/stream", async (_req, { getSession, params }) => {
      const session = getSession(params.sessionId);
      return new Response(await session.getEventStream(), {
        headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      });
    }),
  ],
});
```

`continuationToken` is our thread identity. Once auth exists it becomes
`web:<userId>:<threadId>`; until then a per-browser id in `localStorage`. Re-keying later
is supported (`session.setContinuationToken`), so this is not a decision we are stuck with.

---

## 8. Client integration

The one new file on the app side:

```ts
// components/coach/client.ts
import { Client } from "eve/client";

export const coach = new Client({ host: "" }); // same origin
```

`useCoachThread` keeps its exact public shape, `{ messages, isTyping, send, answer,
acceptSuggestion, dismissSuggestion }`, so `thread.tsx`, `composer.tsx`, `coach-dock.tsx`
and both `/coach` and the floating panel need **no changes**. Only the body of the hook
changes: `pickReply()` becomes a streamed session send.

Signals get one small hook:

```ts
// components/coach/use-signal.ts
export function useCoachSignal() {
  // debounce 2s, drop if >1 nudge in 10 min (mirrors agent-side nudges state)
  return React.useCallback((type: string, payload: Record<string, unknown>) => { … }, []);
}
```

Call sites, five lines total, one per surface:

```ts
// app/(app)/profile/page.tsx      → signal("vault.item_added", { id: item.id })
// app/(app)/todo/page.tsx         → signal("todo.completed", { id })
// app/(app)/career-map/page.tsx  → signal("path.target_set", { id })
```

**Rate limiting is enforced on both sides.** Client debounce stops event storms from
reaching the network; agent-side `nudges` state stops the Coach repeating itself across
sessions. Neither alone is sufficient.

### Degradation

If the agent is unreachable, `useCoachThread` falls back to the existing `replies.ts` and
the composer shows a quiet "Coach đang ngoại tuyến" line. **We keep `replies.ts`**; it
becomes the offline path and the demo path, not dead code. Signals fail silently: a
missed nudge is invisible, so it must never surface an error.

---

## 9. File map

```
NewOpenPath/
├── app/                      ← unchanged
├── components/coach/
│   ├── thread.tsx            ← hook body swapped, interface identical
│   ├── composer.tsx          ← unchanged
│   ├── coach-dock.tsx        ← + renders nudges
│   ├── history.tsx           ← unchanged
│   ├── replies.ts            ← kept as offline fallback
│   ├── client.ts             ← NEW
│   └── use-signal.ts         ← NEW
├── lib/
│   ├── data.ts               ← unchanged (single source of mock truth)
│   └── career-graph.ts       ← unchanged
├── agent/                    ← NEW, all of it
│   ├── agent.ts
│   ├── instructions.md
│   ├── channels/web.ts
│   ├── tools/{get_profile,get_plan,get_paths,propose_change}.ts
│   ├── skills/{review-cv,compare-paths,plan-next-weeks,gap-to-role,market-check}.md
│   ├── hooks/telemetry.ts
│   ├── schedules/weekly-checkin.ts
│   └── lib/{context.ts,state.ts}
└── evals/coach/              ← NEW
```

**Where new work goes**, the rule that keeps this clean:

| I want to… | I add | I never touch |
|---|---|---|
| teach a new coaching move | one file in `skills/` | instructions, tools |
| let the Coach read something new | one file in `tools/` | skills, UI |
| react to a new user action | one `signal()` call + one row in the signal table | agent internals |
| change voice or boundaries | `instructions.md` | everything else |
| change the model | one line in `agent.ts` | everything else |

---

## 10. Evals

`evals/coach/`, the check that this stays good as we add skills.

Minimum set before we call it done:

1. **Voice**, replies are Vietnamese, use "mình/bạn", ≤ 3 paragraphs.
2. **Evidence**, a claim about the user's profile cites something from `get_profile`.
3. **Next step**; every reply ends with one concrete action.
4. **Silence**, across 20 mixed signals, `speak: true` fires ≤ 4 times. *This is the
   eval most likely to fail and the most important one to keep.*
5. **Proposal validity**, `propose_change` payloads always parse against the client's
   expected shape.
6. **Boundaries**, legal/medical/financial questions are declined and redirected.

---

## 11. Rollout

| Phase | Deliverable | Exit criterion |
|---|---|---|
| **1** | `npx eve init .`, `agent.ts` + NVIDIA key, `instructions.md`, `channels/web.ts` | `/coach` answers a real question in Vietnamese, streamed |
| **2** | Read tools + `useCoachThread` swap + offline fallback | Full thread and dock work on the real agent; `replies.ts` only on failure |
| **3** | Skills + `propose_change` wired to `SuggestionCard` | Accepting a proposal changes app state, as the seeded card does today |
| **4** | Signals from 3 surfaces + `nudges` state | Nudges appear, and stay rare under eval #4 |
| **5** | Schedule + hooks/telemetry + evals in CI | Weekly check-in fires; eval suite green |

Each phase ships independently and is reversible: delete `agent/` and the app is exactly
what it is today.

---

## 12. Risks and open questions

**Verified from the Eve docs; not yet run.** Every API in this document
(`defineAgent`, `defineTool`, `defineSkill`, `defineChannel`, `defineHook`,
`defineSchedule`, `defineState`, `eve/client`) is quoted from eve.dev as of this writing.
Nothing here has been executed against a live install. Phase 1 exists to validate the
scaffold before we build on it, expect signature drift and treat this document as
correctable on contact.

| Risk | Mitigation |
|---|---|
| Vietnamese quality varies sharply by model | Eval #1 gates the model choice; swapping is one line |
| Latency makes the dock feel sluggish | Stream tokens; `reasoning: "low"`; nudges are async and never block |
| Nudges become annoying | Silence-by-default + two-sided rate limit + eval #4 |
| Agent state and mock `lib/data.ts` drift | All reads go through `agent/lib/context.ts`; one seam |
| Cost from signal traffic | Client debounce + hard session token caps in `agent.ts` |
| Secret leakage | `NVIDIA_API_KEY` server-side only; never in a client component |

**Open questions for the team**

1. **Auth timing.** Continuation tokens are per-browser until there are real users. When
   does auth land? That decides whether threads survive a device change.
2. **Where do accepted proposals persist?** Today they toast and update React state. A
   real `add-todo` needs somewhere to write.
3. **Do we want the Coach to read the vault documents themselves** (the actual CV file),
   or only their metadata? That is the difference between real CV review and generic
   advice, and it needs file storage + a sandbox.

---

## References

- [Eve, Getting Started](https://eve.dev/docs/getting-started) ·
  [Installation](https://eve.dev/docs/installation) ·
  [Project structure](https://eve.dev/docs/project-structure)
- [agent.ts config](https://eve.dev/docs/agent-config) ·
  [Instructions](https://eve.dev/docs/instructions) ·
  [Tools](https://eve.dev/docs/tools) ·
  [Skills](https://eve.dev/docs/skills)
- [Custom channels](https://eve.dev/docs/channels/custom) ·
  [Hooks](https://eve.dev/docs/guides/hooks) ·
  [State](https://eve.dev/docs/guides/state) ·
  [Schedules](https://eve.dev/docs/schedules) ·
  [Client SDK](https://eve.dev/docs/guides/client/overview)
- [NVIDIA NIM, OpenAI-compatible API](https://docs.api.nvidia.com/nim/reference/llm-apis)
