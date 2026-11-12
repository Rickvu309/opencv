import { is } from "drizzle-orm"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"

export function jsonbColumnKeys(schemaExports: Record<string, unknown>) {
  const keys = new Set<string>()
  for (const value of Object.values(schemaExports)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    for (const column of config.columns) {
      if (column.getSQLType() === "jsonb") {
        keys.add(`${config.name}.${column.name}`)
      }
    }
  }
  return [...keys].sort()
}

export function unclassifiedJsonbColumns(
  schemaExports: Record<string, unknown>,
  classified: Iterable<string>
) {
  const known = new Set(classified)
  return jsonbColumnKeys(schemaExports).filter((key) => !known.has(key))
}
