import { customType, timestamp } from "drizzle-orm/pg-core"

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
})
