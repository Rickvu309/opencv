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
 *
 * `useLiveQuery` has no server snapshot, so it only mounts in the browser.
 * SSR and the first paint use the table over the AppState rows.
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

export function OrderedDriveRows({
  rows,
  children,
}: {
  rows: DriveRow[];
  children: (ordered: DriveRow[]) => React.ReactNode;
}) {
  const fallback = useDriveTable(rows);
  const [client, setClient] = React.useState(false);
  React.useEffect(() => {
    setClient(true);
  }, []);
  if (!client) return children(fallback);
  return React.createElement(LiveOrderedDriveRows, { rows, children });
}

function LiveOrderedDriveRows({
  rows,
  children,
}: {
  rows: DriveRow[];
  children: (ordered: DriveRow[]) => React.ReactNode;
}) {
  return children(useDriveRows(rows));
}
