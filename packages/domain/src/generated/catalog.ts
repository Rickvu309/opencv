import { operation as operation0 } from "../operations/job/priority-counts/operation.js"
import { operation as operation1 } from "../operations/job/set-priority/operation.js"
import { operation as operation2 } from "../operations/paper/export/operation.js"
import { operation as operation3 } from "../operations/paper/import/operation.js"
import { operation as operation4 } from "../operations/paper/read/operation.js"

export const catalog = {
  "job.priorityCounts": operation0,
  "job.setPriority": operation1,
  "paper.export": operation2,
  "paper.import": operation3,
  "paper.read": operation4,
} as const

export const catalogDigest =
  "8259510c6685e394ddb06d357b80a8189c68eec72d09240a1811195e44dd3ea7"
