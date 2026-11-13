const WEAKENED = {
  path: "apps/web/src/features/paper/paper-letter-edits.test.ts",
  kind: "test",
  what: "case-removed",
  subject:
    "apps/web/src/features/paper/paper-letter-edits.test.ts > letterEdits > refuses a letter that needs more inserts than one save allows",
}

const PROVED = {
  file: "scripts/retired/1381.json",
  issue: 1381,
  subject: WEAKENED.subject,
  because: "one save now carries any letter length",
  replacedBy: "apps/web/src/features/paper/paper-letter-lines.test.ts",
  proof: { replacedByBlob: "b2", failedOnBase: true, passedOnHead: true },
}

const changed = [
  {
    path: "apps/web/src/features/paper/paper-letter-lines.test.ts",
    headBlob: "b2",
  },
]

export const PROTECTED_CASES = [
  [
    "PROTECTED_WEAKENED",
    { protected: { weakened: [WEAKENED], retired: [], retirements: [] } },
    {
      protected: {
        weakened: [],
        retired: [{ ...WEAKENED, retiredBy: WEAKENED.subject }],
        retirements: [PROVED],
        changed,
      },
    },
    `the change weakens 1 protected check(s) it may not weaken without a retirement: case-removed ${WEAKENED.subject}`,
  ],
  [
    "RETIRE_UNPROVEN",
    {
      protected: {
        weakened: [],
        retired: [{ ...WEAKENED, retiredBy: WEAKENED.subject }],
        retirements: [{ ...PROVED, proof: undefined }],
        changed,
      },
    },
    {
      protected: {
        weakened: [],
        retired: [{ ...WEAKENED, retiredBy: WEAKENED.subject }],
        retirements: [PROVED],
        changed,
      },
    },
    `a retirement is not proved: "${WEAKENED.subject}" has no flip proof for the current apps/web/src/features/paper/paper-letter-lines.test.ts (it must fail on the fork point and pass on the head)`,
  ],
]
