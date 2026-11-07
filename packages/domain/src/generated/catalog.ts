import { operation as operation0 } from "../operations/job/priority-counts/operation.js"
import { operation as operation1 } from "../operations/job/set-priority/operation.js"

export const catalog = {
  "job.priorityCounts": operation0,
  "job.setPriority": operation1,
} as const

export const catalogDigest =
  "252271e53d1ad8ed88796b0bd15552e9870fbe77e289b1208b89fd1359240ff5"
