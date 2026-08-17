import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";

import type { DriveRow } from "./drive";

/**
 * A read-model of Drive rows. Writes still go through `dispatch`.
 *
 * TanStack DB is a query engine over collections, not a second AppState.
 * This collection is rebuilt from the document the store already owns.
 */
export function driveCollectionOf(rows: readonly DriveRow[]) {
  return createCollection(
    localOnlyCollectionOptions({
      id: "drive-rows",
      getKey: (row: DriveRow) =>
        row.kind === "paper" ? `paper:${row.item.id}` : `upload:${row.item.id}`,
      initialData: [...rows],
    }),
  );
}
