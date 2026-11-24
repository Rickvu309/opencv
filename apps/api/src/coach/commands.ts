import { hostTaskApprovals } from "../registry/proposal-hosts.js"
import { hostedTaskApproval } from "./task-approval.js"

export function registerCoachTasks() {
  hostTaskApprovals(hostedTaskApproval)
}
