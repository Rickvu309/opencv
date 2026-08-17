"use client";

import * as React from "react";
import { useLiveQuery } from "@tanstack/react-db";

import { driveCollectionOf } from "./drive-collection";
import type { DriveRow } from "./drive";
import { useDriveTable } from "./use-drive-table";

/**
 * Drive rows as a TanStack DB read-model, then a headless table.
 *
 * The collection is rebuilt from AppState. Writes still go through `dispatch`.
 * Lists stay personal-scale, so they are not virtualized.
 */
export function useDriveRows(rows: DriveRow[]) {
  const key = rows
    .map((row) =>
      row.kind === "paper"
        ? `paper:${row.item.id}:${row.item.label}`
        : `upload:${row.item.id}:${row.item.label}`,
    )
    .join("|");
  const collection = React.useMemo(() => driveCollectionOf(rows), [key]);
  const { data } = useLiveQuery(
    (q) => q.from({ row: collection }),
    [collection],
  );
  const live = (data ?? rows) as DriveRow[];
  return useDriveTable(live);
}
