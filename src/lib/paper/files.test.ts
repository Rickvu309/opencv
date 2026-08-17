import { test } from "node:test";
import assert from "node:assert/strict";

import { isFileMime, mimeFromName } from "./files";

test("only pdf and Word files are accepted", () => {
  assert.equal(isFileMime("application/pdf"), true);
  assert.equal(isFileMime("image/jpeg"), false);
  assert.equal(mimeFromName("cv.pdf"), "application/pdf");
  assert.equal(mimeFromName("letter.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(mimeFromName("notes.txt"), null);
});
