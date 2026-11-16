export const MERGE_GATE_CASES = [
  [
    "MIGRATION_CHANGES",
    {
      pull: { n: 1326 },
      migrations: {
        allowed: [],
        files: [{ tag: "0022_drop_notify", changes: ["DROP"] }],
      },
    },
    {
      pull: { n: 1326 },
      migrations: {
        allowed: ["0022_drop_notify"],
        files: [{ tag: "0022_drop_notify", changes: ["DROP"] }],
      },
    },
    "the merge runs 0022_drop_notify (DROP) on production data, and it changes existing things",
  ],
  [
    "QUEUE_CLOSED",
    {
      pull: { n: 1500, labels: [] },
      issues: [{ number: 1600, state: "OPEN", labels: ["production-red"] }],
    },
    {
      pull: { n: 1500, labels: ["production-red-revert"] },
      issues: [{ number: 1600, state: "OPEN", labels: ["production-red"] }],
    },
    "production is red (#1600 open), so only a pull request labeled production-red-revert merges",
  ],
  [
    "MIGRATION_CHANGES",
    {
      pull: { n: 7 },
      migrations: {
        allowed: ["0023_package_trash"],
        files: [
          { tag: "0023_package_trash", changes: [] },
          {
            tag: "0024_word_rename_retained",
            changes: ["CREATE OR REPLACE", "a trigger"],
          },
        ],
      },
    },
    {
      pull: { n: 7 },
      migrations: {
        allowed: ["0024_word_rename_retained"],
        files: [
          { tag: "0023_package_trash", changes: [] },
          {
            tag: "0024_word_rename_retained",
            changes: ["CREATE OR REPLACE", "a trigger"],
          },
        ],
      },
    },
    "the merge runs 0024_word_rename_retained (CREATE OR REPLACE, a trigger) on production data, and it changes existing things",
  ],
]
