import { createHash, randomUUID } from "node:crypto"
import {
  canonicalPaper,
  nativeProvenance,
  paperPhotoRef,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import { richPaper } from "../rich-paper.js"
import type { RouteCase } from "./route-cases.js"

export const nativeWordRouteCase: RouteCase = {
  method: "GET",
  path: "/api/paper/:id/native-word",
  arrange: async (as) => {
    const saved = await as.command("paper.create", {
      kind: "cv",
      name: "Word route",
    })
    if (typeof saved.id !== "string") throw new Error("Missing Paper identity")
    const document = richPaper("cv", paperPhotoRef(randomUUID()))
    return {
      id: saved.id,
      basis: JSON.stringify({
        provenance: nativeProvenance(document),
        epoch: 1,
        revision: 0,
        digest: createHash("sha256")
          .update(canonicalPaper(document))
          .digest("hex"),
      }),
    }
  },
  request: (as, ids, signal) =>
    new Request(`http://localhost/api/paper/${ids.id}/native-word?kind=cv`, {
      headers: {
        Cookie: as.cookie,
        "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
        "x-paper-basis": ids.basis ?? "",
      },
      signal,
    }),
}
