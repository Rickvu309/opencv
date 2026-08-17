// The check the product cannot do without: "mình đã thêm rồi nhé" when nothing
// was added. The instruction file has asked for this since the beginning and
// nothing has ever verified it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkOutput } from "@/lib/guardrails/output";
import { messages } from "@/lib/i18n/messages";

const added = [{ action: "profile.addCourse", ok: true }];
const failed = [{ action: "profile.addCourse", ok: false }];

test("AC-TRUST-002.2: a claim with nothing behind it is corrected", () => {
  for (const reply of [
    "Mình thêm khoá học đó vào hồ sơ rồi nhé.",
    "Mình đã cập nhật CV của bạn.",
    "I've added that course to your profile.",
    "I updated your CV for you.",
  ]) {
    const verdict = checkOutput({ reply, toolResults: [] });
    assert.equal(verdict.kind, "revise", `let through: ${reply}`);
  }
});

test("AC-TRUST-002.1: the same sentence after a successful action is fine", () => {
  // The Coach doing exactly what it should. A guard that flagged this would
  // make every real change look like a lie.
  const verdict = checkOutput({
    reply: "Mình thêm khoá học đó vào hồ sơ rồi nhé.",
    toolResults: added,
  });
  assert.equal(verdict.kind, "allow");
  assert.equal(verdict.findings.length, 0);
});

test("an action that failed does not count as evidence", () => {
  const verdict = checkOutput({
    reply: "Mình đã cập nhật CV của bạn.",
    toolResults: failed,
  });
  assert.equal(verdict.kind, "revise");
});

test("the correction is appended in English", () => {
  const claimed = checkOutput({ reply: "Mình đã tạo thư xin việc." });
  assert.equal(claimed.kind, "revise");
  assert.match(claimed.reply, /Mình đã tạo thư xin việc\./, "the reply is kept");
  assert.ok(claimed.reply.includes(messages.guardrails.noActionTaken));

  const en = checkOutput({ reply: "I've created your cover letter." });
  assert.ok(en.reply.includes(messages.guardrails.noActionTaken));
});

test("an offer to act is not a claim to have acted", () => {
  // "I will add" and "you can add" tell the user nothing is done yet. Flagging
  // them would make the Coach unable to offer anything.
  for (const reply of [
    "Mình sẽ thêm khoá học đó nếu bạn muốn.",
    "Bạn có thể thêm mục này vào CV.",
    "I can add that course if you'd like.",
    "Should I update your CV?",
  ]) {
    assert.equal(
      checkOutput({ reply, toolResults: [] }).kind,
      "allow",
      `wrongly flagged: ${reply}`,
    );
  }
});

test("an ordinary answer with no claim in it passes untouched", () => {
  const reply =
    "Với vị trí data analyst, hai thứ nhà tuyển dụng nhìn đầu tiên là SQL và một dự án thật. Tuần này bạn thử làm một dashboard nhỏ từ dữ liệu bán hàng nhé.";
  const verdict = checkOutput({ reply });
  assert.equal(verdict.kind, "allow");
  assert.equal(verdict.reply, reply);
});

test("advice the Coach is not fit to give is recorded even when it is not rewritten", () => {
  // Standard strictness lets it stand: the reply is unhelpful rather than
  // harmful, and rewriting a model's words on a maybe is its own dishonesty.
  // But the finding still travels, or the sink counts zero and everyone
  // concludes it never happens.
  const verdict = checkOutput({
    reply: "Theo luật thì bạn có quyền khởi kiện công ty.",
  });
  assert.equal(verdict.kind, "allow");
  assert.equal(verdict.findings.length, 1);
  assert.equal(verdict.findings[0].rule, "out-of-scope-advice");
});

test("strict strictness corrects it as well as recording it", () => {
  const verdict = checkOutput({
    reply: "Theo luật thì bạn có quyền khởi kiện công ty.",
    config: { strictness: "strict" },
  });
  assert.equal(verdict.kind, "revise");
});

test("promising an offer or a salary is caught", () => {
  for (const reply of [
    "Với CV này bạn chắc chắn sẽ đậu phỏng vấn.",
    "You'll definitely get the job with this.",
  ]) {
    const verdict = checkOutput({ reply });
    assert.equal(verdict.findings.length, 1, `missed: ${reply}`);
    assert.equal(verdict.findings[0].rule, "over-promise");
  }
});

test("an honest estimate is not an over-promise", () => {
  const verdict = checkOutput({
    reply:
      "Với hồ sơ hiện tại, mình nghĩ bạn còn khoảng ba tháng nữa mới đủ sức ứng tuyển vị trí này.",
  });
  assert.equal(verdict.findings.length, 0);
});

test("strictness off checks nothing", () => {
  const verdict = checkOutput({
    reply: "Mình đã cập nhật CV của bạn.",
    toolResults: [],
    config: { strictness: "off" },
  });
  assert.equal(verdict.kind, "allow");
  assert.equal(verdict.findings.length, 0);
});
