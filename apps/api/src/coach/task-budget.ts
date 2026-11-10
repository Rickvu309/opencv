export const COACH_TASK_MAX_STEPS = 8
export const COACH_STEP_OUTPUT_LIMIT = 4096
export const COACH_TASK_OUTPUT_BUDGET =
  COACH_TASK_MAX_STEPS * COACH_STEP_OUTPUT_LIMIT

export class TaskBudgetError extends Error {
  constructor() {
    super("Task budget exceeded")
    this.name = "TaskBudgetError"
  }
}

export function outputBlocksAnotherStep(
  outputTokens: number,
  maxTokens: number
) {
  return outputTokens >= maxTokens
}

export function outputOverBudget(outputTokens: number, maxTokens: number) {
  return outputTokens > maxTokens
}

export function providerOutputLimit(outputTokens: number, maxTokens: number) {
  return Math.min(COACH_STEP_OUTPUT_LIMIT, maxTokens - outputTokens)
}
