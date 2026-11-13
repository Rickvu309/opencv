import { sql } from "drizzle-orm"

import { ownedTableNames, type OwnedTable } from "../registry/owned.js"

export type WriteOp = "insert" | "update" | "delete"

export type LoggedWrite = {
  seq: number
  table: OwnedTable
  op: WriteOp
  owner: string | null
  row: Record<string, unknown>
}

type Executor = { exec(query: string): Promise<unknown> }

type Reader = {
  execute(query: ReturnType<typeof sql>): Promise<{ rows: unknown[] }>
}

const LONG_VALUE = 512

export function writeLogSql(
  tables: readonly { schema: string; name: string }[]
) {
  const triggers = tables.map(
    (table) =>
      `create trigger test_write_log after insert or update or delete on "${table.schema}"."${table.name}" for each row execute function test_log.record_write();`
  )
  return [
    "create schema if not exists test_log;",
    "create table test_log.writes (seq bigserial primary key, table_schema text not null, table_name text not null, op text not null, owner text, row jsonb not null);",
    `create or replace function test_log.record_write() returns trigger language plpgsql as $$
declare
  full_row jsonb;
  short_row jsonb;
begin
  if tg_op = 'DELETE' then full_row := to_jsonb(old); else full_row := to_jsonb(new); end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into short_row
    from jsonb_each(full_row) where length(value::text) < ${LONG_VALUE};
  insert into test_log.writes (table_schema, table_name, op, owner, row)
    values (tg_table_schema, tg_table_name, lower(tg_op), coalesce(full_row->>'user_id', full_row->>'owner_id'), short_row);
  return null;
end
$$;`,
    ...triggers,
  ].join("\n")
}

export async function installWriteLog(client: Executor) {
  await client.exec(writeLogSql(ownedTableNames()))
}

const keyOfName = new Map(
  ownedTableNames().map((table) => [`${table.schema}.${table.name}`, table.key])
)

type RawWrite = {
  seq: string | number
  table_schema: string
  table_name: string
  op: WriteOp
  owner: string | null
  row: Record<string, unknown>
}

export async function writesAfter(
  db: Reader,
  seq: number
): Promise<LoggedWrite[]> {
  const result = await db.execute(
    sql`select seq, table_schema, table_name, op, owner, row from test_log.writes where seq > ${seq} order by seq`
  )
  return (result.rows as RawWrite[]).flatMap((raw) => {
    const table = keyOfName.get(`${raw.table_schema}.${raw.table_name}`)
    if (!table) return []
    return [
      {
        seq: Number(raw.seq),
        table,
        op: raw.op,
        owner: raw.owner,
        row: raw.row,
      },
    ]
  })
}

export async function lastWrite(db: Reader): Promise<number> {
  const result = await db.execute(
    sql`select coalesce(max(seq), 0) as seq from test_log.writes`
  )
  return Number((result.rows[0] as { seq: string | number }).seq)
}
