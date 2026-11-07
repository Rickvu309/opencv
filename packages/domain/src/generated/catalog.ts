import { operation as operation0 } from "../operations/job/priority-counts/operation.js"
import { operation as operation1 } from "../operations/job/set-priority/operation.js"

export const catalog = {
  "job.priorityCounts": operation0,
  "job.setPriority": operation1,
} as const

export const catalogDigest =
  "64f7d54920cd008321a441d1d282f4df43cc4cce752ac0d31713b4684569301d"
