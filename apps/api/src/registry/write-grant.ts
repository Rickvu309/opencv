import { AsyncLocalStorage } from "node:async_hooks"

import { ERROR_CODES, type VersionedResource } from "@workspace/domain/kernel"

import { getDb, insideTransaction } from "../db/context.js"
import { CommandError } from "../platform/errors.js"

const grantBrand = Symbol("versioned-write-grant")

export type WriteGrant = {
  readonly ownerId: string
  readonly resource: string
  readonly entityId: string
  readonly transaction: object
  readonly expectedRevision: number | null
  readonly [grantBrand]: true
}

export type GrantedResource = { name: string; versioned: VersionedResource }

type AdmittedWrite = {
  name: string
  entityId?: string
  versioned?: VersionedResource
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

function grantKey(resource: string, entityId: string) {
  return JSON.stringify([resource, entityId])
}

function assertScope(authority: Readonly<WriteGrant & { scope: OpenScope }>) {
  if (scopes.getStore() !== authority.scope || authority.scope.sealed)
    throw refused("This permission has ended")
  if (!insideTransaction() || authority.transaction !== getDb())
    throw refused("This permission is for a different save")
}

function refused(message: string) {
  return new CommandError(ERROR_CODES.FORBIDDEN, message)
}

export function basisRevisionOk(captured: number | null, current: number) {
  return captured !== null && captured === current
}

export function versionedWrite<W extends AdmittedWrite>(writes: readonly W[]) {
  return writes.find((write) => write.versioned)?.versioned ?? null
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
    if (!write.versioned || !write.entityId) continue
    open.available.add(grantKey(write.name, write.entityId))
  }
  return scopes.run(open, async () => {
    try {
      return await run()
    } finally {
      open.sealed = true
    }
  })
}

export function takeWriteGrant(
  resource: GrantedResource,
  entityId: string
): WriteGrant {
  const open = scopes.getStore()
  if (!open || open.sealed) throw refused("This permission has ended")
  if (!insideTransaction())
    throw refused("This permission is for a different save")
  const key = grantKey(resource.name, entityId)
  if (!open.available.has(key))
    throw refused(
      `This save has no permission for that ${resource.versioned.holder}`
    )
  open.available.delete(key)
  const grant: WriteGrant = {
    [grantBrand]: true,
    ownerId: open.ownerId,
    resource: resource.name,
    entityId,
    transaction: getDb(),
    expectedRevision: open.expectedRevision,
  }
  authorities.set(grant, Object.freeze({ ...grant, scope: open }))
  return grant
}

export function assertWriteGrant(
  grant: WriteGrant,
  resource: GrantedResource,
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
  if (authority.resource !== resource.name)
    throw refused("This permission is for a different change")
  if (
    !open ||
    authority.ownerId !== open.ownerId ||
    authority.ownerId !== ownerId
  )
    throw refused("This permission is for someone else")
  if (authority.entityId !== entityId)
    throw refused(
      `This permission is for a different ${resource.versioned.holder}`
    )
  spent.add(grant)
  return {
    ownerId: authority.ownerId,
    expectedRevision: authority.expectedRevision,
    assertOpen: () => assertScope(authority),
  }
}
