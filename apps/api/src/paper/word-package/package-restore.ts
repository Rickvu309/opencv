import { and, eq } from "drizzle-orm"

import { getDb } from "../../db/context.js"
import { paperPackageHeads } from "../../db/schema.js"
import { packageFailure } from "./package-pages.js"

function unavailable(): never {
  return packageFailure(
    "This saved Word edit is no longer available. No document was changed."
  )
}

export async function readPackageHead(
  owner: string,
  docId: string,
  incarnation: string,
  revision: string
) {
  const [head] = await getDb()
    .select({ revision: paperPackageHeads.revision })
    .from(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId),
        eq(paperPackageHeads.incarnation, incarnation),
        eq(paperPackageHeads.revision, revision)
      )
    )
  if (!head) return unavailable()
  return head
}

export async function compareAndRestorePackage(
  owner: string,
  docId: string,
  incarnation: string,
  expectedRevision: string,
  nextRevision: string
) {
  const changed = await getDb()
    .update(paperPackageHeads)
    .set({ revision: nextRevision })
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId),
        eq(paperPackageHeads.incarnation, incarnation),
        eq(paperPackageHeads.revision, expectedRevision)
      )
    )
    .returning({ revision: paperPackageHeads.revision })
  if (changed.length !== 1) return unavailable()
  return { docId, incarnation, revision: nextRevision }
}

export async function revalidateUnchangedPackage(
  owner: string,
  docId: string,
  incarnation: string,
  revision: string
) {
  await readPackageHead(owner, docId, incarnation, revision)
}
