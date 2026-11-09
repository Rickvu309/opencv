import { sql } from "drizzle-orm"
import { timestamptz } from "./column-types.js"
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
  type PgSchema,
} from "drizzle-orm/pg-core"

export function createPaperPackageTables(
  opencvApp: PgSchema<"opencv_app">,
  user: { id: AnyPgColumn },
  files: { id: AnyPgColumn }
) {
  const paperPackageVersions = opencvApp.table(
    "paper_package_versions",
    {
      revision: uuid("revision").primaryKey(),
      parentRevision: uuid("parent_revision"),
      docId: uuid("doc_id").notNull(),
      incarnation: uuid("incarnation").notNull(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      requestId: uuid("request_id").notNull(),
      name: text("name").notNull(),
      kind: text("kind").$type<"cv" | "letter">().notNull(),
      fileId: uuid("file_id")
        .notNull()
        .references(() => files.id),
      packageHash: text("package_hash").notNull(),
      byteSize: integer("byte_size").notNull(),
      sidecar: jsonb("sidecar").$type<unknown>().notNull(),
      sidecarHash: text("sidecar_hash").notNull(),
      projection: jsonb("projection").$type<unknown>().notNull(),
      projectionHash: text("projection_hash").notNull(),
      projector: text("projector").notNull(),
      cursorKey: text("cursor_key").notNull(),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("paper_package_request_idx").on(
        table.userId,
        table.requestId
      ),
      unique("paper_package_identity_idx").on(
        table.docId,
        table.userId,
        table.incarnation,
        table.revision
      ),
      check(
        "paper_package_byte_size",
        sql`${table.byteSize} > 0 AND ${table.byteSize} <= 8388608`
      ),
      check("paper_package_kind", sql`${table.kind} IN ('cv', 'letter')`),
    ]
  )

  const paperPackageHeads = opencvApp.table(
    "paper_package_heads",
    {
      docId: uuid("doc_id").primaryKey(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      incarnation: uuid("incarnation").notNull(),
      revision: uuid("revision").notNull(),
      canvasProfile: text("canvas_profile"),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (table) => [
      foreignKey({
        name: "paper_package_head_version_fk",
        columns: [table.docId, table.userId, table.incarnation, table.revision],
        foreignColumns: [
          paperPackageVersions.docId,
          paperPackageVersions.userId,
          paperPackageVersions.incarnation,
          paperPackageVersions.revision,
        ],
      }),
      index("paper_package_heads_owner_idx").on(table.userId),
    ]
  )

  const paperPackageCandidates = opencvApp.table(
    "paper_package_candidates",
    {
      id: uuid("id").primaryKey(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      docId: uuid("doc_id").notNull(),
      incarnation: uuid("incarnation").notNull(),
      basisRevision: uuid("basis_revision").notNull(),
      forwardRevision: uuid("forward_revision").notNull(),
      restoreRevision: uuid("restore_revision").notNull(),
      seal: jsonb("seal").$type<unknown>().notNull(),
      digest: text("digest").notNull(),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (table) => [
      ...(
        [
          ["basis", table.basisRevision],
          ["forward", table.forwardRevision],
          ["restore", table.restoreRevision],
        ] as const
      ).map(([role, revision]) =>
        foreignKey({
          name: `paper_package_candidate_${role}_fk`,
          columns: [table.docId, table.userId, table.incarnation, revision],
          foreignColumns: [
            paperPackageVersions.docId,
            paperPackageVersions.userId,
            paperPackageVersions.incarnation,
            paperPackageVersions.revision,
          ],
        })
      ),
      index("paper_package_candidates_owner_idx").on(table.userId),
    ]
  )

  return { paperPackageVersions, paperPackageHeads, paperPackageCandidates }
}
