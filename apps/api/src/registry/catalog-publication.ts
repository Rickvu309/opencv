import type { Operation } from "@workspace/domain"
import type { activity } from "../db/schema.js"
import { receiptDetail, reversalOf } from "./receipt.js"
import type { ExecuteResult } from "./registry-types.js"
import { readTurnReceipts } from "./turn-receipts.js"

export class CatalogPublication {
  protected readonly operations = new Map<string, Operation>()

  adopt(operation: Operation) {
    this.operations.set(operation.name, operation)
  }

  publicOutput(name: string, output: unknown) {
    const operation = this.operations.get(name)
    return operation ? operation.publicResult.parse(output) : output
  }

  fitsPublicShape(name: string, output: unknown) {
    const operation = this.operations.get(name)
    return !operation || operation.publicResult.safeParse(output).success
  }

  isCatalogOperation(name: string) {
    return this.operations.has(name)
  }

  protected publicActivity<
    T extends {
      command: string
      result: unknown
      reversalInput: unknown
      detail: unknown
    },
  >(row: T) {
    return this.operations.has(row.command)
      ? {
          ...row,
          result: this.publicOutput(row.command, row.result),
          reversalInput: {},
          reversalExpect: null,
          detail: null,
        }
      : row
  }

  protected publishResult(name: string, result: ExecuteResult): ExecuteResult {
    if (!this.operations.has(name) || result.pending) return result
    return {
      ...result,
      output: this.publicOutput(name, result.output),
      reversal: result.reversal
        ? { command: result.reversal.command, input: {} }
        : null,
      detail: undefined,
    }
  }

  protected confirmationReceipt(
    completed: typeof activity.$inferSelect | null
  ) {
    return completed
      ? {
          summary: completed.summary,
          activityId: completed.id,
          reversal: reversalOf(
            completed.reversalCommand
              ? {
                  command: completed.reversalCommand,
                  input: this.operations.has(completed.command)
                    ? {}
                    : completed.reversalInput,
                }
              : null,
            completed.summary
          ),
          detail: this.operations.has(completed.command)
            ? undefined
            : receiptDetail(completed.command, completed.result),
          undone: completed.undoneAt !== null,
        }
      : undefined
  }

  catalogRead(name: string) {
    return this.operations.get(name)?.kind === "read"
  }

  protected committedResult(
    name: string,
    input: never,
    ownerId: string,
    result: ExecuteResult
  ): ExecuteResult {
    const operation = this.operations.get(name)
    const touches =
      result.touches ??
      (operation?.kind === "command"
        ? operation.writes(input).map(({ name, entityId }) => ({
            ownerId,
            name,
            ...(entityId ? { entityId } : {}),
          }))
        : [{ ownerId, name: "workspace" }])
    return { ...this.publishResult(name, result), touches }
  }

  async turnReceipts(userId: string, turnIds: string[]) {
    const receipts = await readTurnReceipts(userId, turnIds)
    return receipts.map((receipt) => ({
      ...receipt,
      result: this.publishResult(receipt.name, receipt.result),
    }))
  }
}
