// The email check is the only validation standing between a stranger and the
// one thing this product stores centrally. These tests are about what it must
// refuse, and just as importantly what it must not.

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkEmail, normalizeEmail } from "@/lib/email";

test("ordinary addresses are accepted", () => {
  for (const email of [
    "minh@example.com",
    "minh.anh@example.com.vn",
    "minh+openpath@example.co",
    "MINH@EXAMPLE.COM",
    "  minh@example.com  ",
    "nguyen_van_a@truong.edu.vn",
  ]) {
    assert.equal(checkEmail(email), null, `${email} should be accepted`);
  }
});

test("what is obviously not an address is refused", () => {
  assert.equal(checkEmail(""), "empty");
  assert.equal(checkEmail("   "), "empty");
  assert.equal(checkEmail("minh"), "shape");
  assert.equal(checkEmail("minh@"), "shape");
  assert.equal(checkEmail("@example.com"), "shape");
  // No dot in the domain: "minh@localhost" is valid to a mail server on the
  // same host and useless to a waiting list.
  assert.equal(checkEmail("minh@example"), "shape");
  assert.equal(checkEmail("minh @example.com"), "shape");
  assert.equal(checkEmail("minh@exam ple.com"), "shape");
  assert.equal(checkEmail("minh@@example.com"), "shape");
});

test("an address longer than RFC 5321 allows is refused", () => {
  // Without this one submission could write a very large blob.
  const long = "a".repeat(250) + "@example.com";
  assert.equal(checkEmail(long), "too-long");
});

test("normalization makes the same person one row", () => {
  // The store keys a blob on the normalized address, so this function is what
  // actually enforces "one row per person".
  const forms = ["minh@example.com", "MINH@Example.com", "  Minh@EXAMPLE.com  "];
  const normalized = new Set(forms.map(normalizeEmail));
  assert.equal(normalized.size, 1, "case and spacing must not create new rows");
  assert.equal([...normalized][0], "minh@example.com");
});

test("normalization does not touch the local part beyond case", () => {
  // Gmail treats minh.anh and minhanh as one inbox; most providers do not.
  // Collapsing dots here would silently merge two different people.
  assert.equal(normalizeEmail("minh.anh@example.com"), "minh.anh@example.com");
  assert.equal(normalizeEmail("minh+tag@example.com"), "minh+tag@example.com");
});
