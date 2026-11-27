import { queryOptions } from "@tanstack/react-query"
import { catalog } from "@workspace/domain/kernel"

import { catalogClient } from "./contract-client.ts"

export function paperFirstPagesQuery(ownerId: string, ids: string[]) {
  return queryOptions({
    ...catalogClient.options(ownerId, catalog["paper.firstPages"].name, {
      ids: ids.toSorted(),
    }),
    enabled: ownerId !== "" && ids.length > 0,
    placeholderData: (previous, query) =>
      query?.queryKey[1] === ownerId ? previous : undefined,
  })
}
