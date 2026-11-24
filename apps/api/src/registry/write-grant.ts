import { AsyncLocalStorage } from "node:async_hooks"

import { ERROR_CODES } from "@workspace/domain"

import { getDb, insideTransaction } from "../db/context.js"
import { CommandError } from "../platform/errors.js"

const grantBrand = Symbol("job-priority-grant")

export type WriteGrant = {
  readonly ownerId: string
  readonly resource: "job.priority"
  readonly entityId: string
  readonly transaction: object
  readonly expectedRevision: number | null
  readonly [grantBrand]: true
}

type AdmittedWrite = {
  name: string
  entityId?: string
}

type OpenScope = {
  ownerId: string
  expectedRevision: number | null
  sealed: boolean
  available: Set<string>
}

const scopes = new AsyncLocalStorage<OpenScope>()
const authorities = new WeakMap<
  object,
  Readonly<WriteGrant & { scope: OpenScope }>
>()
const spent = new WeakSet<object>()

function assertScope(authority: Readonly<WriteGrant & { scope: OpenScope }>) {
  if (scopes.getStore() !== authority.scope || authority.scope.sealed)
    throw refused("This permission has ended")
  if (!insideTransaction() || authority.transaction !== getDb())
    throw refused("This permission is for a different save")
}

function refused(message: string) {
  return new CommandError(ERROR_CODES.FORBIDDEN, message)
}

export function priorityBasisOk(captured: number | null, current: number) {
  return captured !== null && captured === current
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
    expectedRevision: scope.expectedRevision ?? null,
    sealed: false,
    available: new Set(),
  }
  for (const write of scope.writes) {
    if (write.name !== "job.priority" || !write.entityId) continue
    open.available.add(write.entityId)
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
  if (!insideTransaction())
    throw refused("This permission is for a different save")
  if (!open.available.has(entityId))
    throw refused("This save has no permission for that job")
  open.available.delete(entityId)
  const grant: WriteGrant = {
    [grantBrand]: true,
    ownerId: open.ownerId,
    resource: "job.priority",
    entityId,
    transaction: getDb(),
    expectedRevision: open.expectedRevision,
  }
  authorities.set(grant, Object.freeze({ ...grant, scope: open }))
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
  const authority = authorities.get(grant)
  if (!authority) throw refused("This permission is not valid")
  assertScope(authority)
  if (
    grant.ownerId !== authority.ownerId ||
    grant.entityId !== authority.entityId ||
    grant.transaction !== authority.transaction ||
    grant.resource !== authority.resource ||
    grant.expectedRevision !== authority.expectedRevision
  )
    throw refused("This permission is not valid")
  if (spent.has(grant)) throw refused("This permission was already used")
  if (authority.resource !== "job.priority")
    throw refused("This permission is for a different change")
  if (
    !open ||
    authority.ownerId !== open.ownerId ||
    authority.ownerId !== ownerId
  )
    throw refused("This permission is for someone else")
  if (authority.entityId !== entityId)
    throw refused("This permission is for a different job")
  spent.add(grant)
  return {
    ownerId: authority.ownerId,
    expectedRevision: authority.expectedRevision,
    assertOpen: () => assertScope(authority),
  }
}
