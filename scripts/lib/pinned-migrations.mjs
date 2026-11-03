const MIGRATION_TAG = /\b\d{4}_[a-z0-9_]+\b/g

export function pinnedMigrationTags(source) {
  return [...source.matchAll(MIGRATION_TAG)].map((match) => match[0])
}
