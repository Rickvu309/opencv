import { AsyncLocalStorage } from "node:async_hooks"

import { ERROR_CODES } from "@workspace/domain"

import { createId } from "../id.js"
import { CommandError } from "./errors.js"

const grantBrand = Symbol("job-priority-grant")

export type WriteGrant = {
  readonly ownerId: string
  readonly resource: "job.priority"
  readonly entityId: string
  readonly transactionId: string
  readonly expectedRevision: number | null
  readonly [grantBrand]: true
}

type AdmittedWrite = {
  name: string
  entityId?: string
}

type OpenScope = {
  ownerId: string
  transactionId: string
  expectedRevision: number | null
  sealed: boolean
  available: Map<string, WriteGrant>
}

const scopes = new AsyncLocalStorage<OpenScope>()
const live = new WeakSet<object>()
const spent = new WeakSet<object>()

function refused(message: string) {
  return new CommandError(ERROR_CODES.FORBIDDEN, message)
}

export function priorityBasisOk(captured: number | null, current: number) {
  return captured !== null && captured === current
}

function mint(open: OpenScope, entityId: string): WriteGrant {
  const grant = {
    [grantBrand]: true as const,
    ownerId: open.ownerId,
    resource: "job.priority" as const,
    entityId,
    transactionId: open.transactionId,
    expectedRevision: open.expectedRevision,
  }
  live.add(grant)
  return grant
}

export async function withGrantScope<T>(
  scope: {
    ownerId: string
    writes: readonly AdmittedWrite[]
    expectedRevision?: number | null
  },
  run: () => Promise<T>
): Promise<T> {
  const open: OpenScope = {
    ownerId: scope.ownerId,
    transactionId: createId(),
    expectedRevision: scope.expectedRevision ?? null,
    sealed: false,
    available: new Map(),
  }
  for (const write of scope.writes) {
    if (write.name !== "job.priority" || !write.entityId) continue
    open.available.set(write.entityId, mint(open, write.entityId))
  }
  return scopes.run(open, async () => {
    try {
      return await run()
    } finally {
      open.sealed = true
    }
  })
}

export function takePriorityGrant(entityId: string): WriteGrant {
  const open = scopes.getStore()
  if (!open || open.sealed) throw refused("This permission has ended")
  const grant = open.available.get(entityId)
  if (!grant) throw refused("This save has no permission for that job")
  open.available.delete(entityId)
  return grant
}

export function assertPriorityGrant(
  grant: WriteGrant,
  ownerId: string,
  entityId: string
) {
  const open = scopes.getStore()
  if (!grant || typeof grant !== "object")
    throw refused("This permission is not valid")
  if (!open || open.sealed) throw refused("This permission has ended")
  if (!live.has(grant)) throw refused("This permission is not valid")
  if (spent.has(grant)) throw refused("This permission was already used")
  if (grant.transactionId !== open.transactionId)
    throw refused("This permission is for a different save")
  if (grant.resource !== "job.priority")
    throw refused("This permission is for a different change")
  if (grant.ownerId !== open.ownerId || grant.ownerId !== ownerId)
    throw refused("This permission is for someone else")
  if (grant.entityId !== entityId)
    throw refused("This permission is for a different job")
  spent.add(grant)
}
