// REQ-TRUST-001. The harm is specific: a cover letter that says "reduced
// processing time by 40%" when nobody measured it, taken into an interview by
// somebody who believed it.
//
// As with the input guard, every case here has a partner proving the guard
// stays quiet when the reply is fine. A Coach that flags its own correct
// answers teaches the user to ignore the flag.

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { checkGrounding, profileFacts } from "@/lib/guardrails/grounding";
import { messages } from "@/lib/i18n/messages";

const state = populated();

test("the profile's own facts are found", () => {
  const facts = profileFacts(state);
  for (const fact of [
    "lê thu hà",
    "data analyst",
    "đại học bách khoa",
    "công ty abc",
    "google data analytics",
  ]) {
    assert.ok(facts.includes(fact), `missing from the facts: ${fact}`);
  }
});

test("AC-TRUST-001.2: an invented percentage is caught", () => {
  const verdict = checkGrounding({
    reply: "Bạn đã giúp đội marketing giảm 40% thời gian làm báo cáo.",
    state,
    locale: "vi",
  });
  assert.equal(verdict.kind, "revise");
  assert.equal(verdict.findings[0].rule, "ungrounded-number");
  assert.match(verdict.findings[0].sample, /40/);
});

test("a number the user supplied in the conversation is grounded", () => {
  // "or supplied by the user" is half of the criterion, and the half that
  // makes the guard usable: the user says it, the Coach writes it down.
  const verdict = checkGrounding({
    reply: "Vậy mình viết là giảm 40% thời gian làm báo cáo nhé.",
    state,
    userSaid: "Đợt đó tụi mình giảm được 40% thời gian làm báo cáo tuần",
    locale: "vi",
  });
  assert.equal(verdict.kind, "allow");
});

test("a number already in the profile is grounded", () => {
  const verdict = checkGrounding({
    reply: "GPA 3.2 của bạn là một điểm mạnh nên đưa lên đầu CV.",
    state,
    locale: "vi",
  });
  assert.equal(verdict.kind, "allow");
});

test("an invented money figure is caught", () => {
  const verdict = checkGrounding({
    reply: "Dự án của bạn tiết kiệm 200 triệu cho công ty.",
    state,
    locale: "vi",
  });
  assert.equal(verdict.kind, "revise");
});

test("ordinary numbers in advice are not treated as results", () => {
  // The line this guard lives or dies on. "Three months from now" and "two
  // questions" are numbers, and neither is a claim about what the user
  // achieved. Flagging them would make the guard fire on almost every reply.
  for (const reply of [
    "Tuần này bạn làm 1 dự án nhỏ, khoảng 3 tháng nữa là đủ sức ứng tuyển.",
    "Start with 2 projects and give it 6 months.",
    "Mình gợi ý 3 việc: học SQL, làm dashboard, và nhắn 5 người đang làm Data.",
  ]) {
    assert.equal(
      checkGrounding({ reply, state, locale: "vi" }).kind,
      "allow",
      `wrongly flagged: ${reply}`,
    );
  }
});

test("AC-TRUST-001.3: an employer the user never had is caught", () => {
  const verdict = checkGrounding({
    reply: "Bạn đã làm ở VNG nên kinh nghiệm đó rất hợp với vị trí này.",
    state,
    locale: "vi",
  });
  assert.equal(verdict.kind, "revise");
  assert.equal(verdict.findings[0].rule, "ungrounded-claim");
});

test("the employer the user did have is not caught", () => {
  const verdict = checkGrounding({
    reply: "Bạn đã thực tập ở Công ty ABC, nên viết rõ kết quả đợt đó.",
    state,
    locale: "vi",
  });
  assert.equal(verdict.kind, "allow");
});

test("an English claim about an experience they do not have is caught", () => {
  const verdict = checkGrounding({
    reply: "Your experience with Kubernetes is worth mentioning here.",
    state,
    locale: "en",
  });
  assert.equal(verdict.kind, "revise");
  assert.equal(verdict.findings[0].rule, "ungrounded-claim");
});

test("advice is not a claim", () => {
  // "You could learn SQL" states nothing about the user. A guard that could
  // not tell advice from assertion would silence the Coach entirely.
  for (const reply of [
    "Bạn có thể học SQL trong hai tuần nếu tập trung.",
    "You could apply to a startup where the bar is lower on tooling.",
    "Nếu bạn từng làm dự án nhóm nào, kể mình nghe để mình viết vào CV.",
  ]) {
    assert.equal(
      checkGrounding({ reply, state, locale: "vi" }).kind,
      "allow",
      `wrongly flagged: ${reply}`,
    );
  }
});

test("the correction is appended and names the doubt", () => {
  const verdict = checkGrounding({
    reply: "Bạn đã giảm 40% thời gian xử lý.",
    state,
    locale: "vi",
  });
  assert.ok(verdict.reply.startsWith("Bạn đã giảm 40%"), "the reply is kept");
  assert.ok(verdict.reply.includes(messages.guardrails.notGrounded.vi));
});

test("what the user wrote about themselves counts as fact", () => {
  // They wrote it. A Coach repeating a line out of the user's own pitch is
  // not inventing anything.
  const withPitch = {
    ...state,
    pitch: [
      {
        id: "p1",
        kind: "bio" as const,
        body: "Mình từng làm ở Tiki, phụ trách báo cáo vận hành.",
        language: "vi" as const,
        updatedAt: 0,
      },
    ],
  };
  const verdict = checkGrounding({
    reply: "Bạn đã làm ở Tiki, nên nhấn vào phần báo cáo vận hành.",
    state: withPitch,
    locale: "vi",
  });
  assert.equal(verdict.kind, "allow");
});

test("strictness off checks nothing", () => {
  const verdict = checkGrounding({
    reply: "Bạn đã giảm 40% thời gian và làm ở NASA.",
    state,
    locale: "vi",
    config: { strictness: "off" },
  });
  assert.equal(verdict.kind, "allow");
  assert.equal(verdict.findings.length, 0);
});
