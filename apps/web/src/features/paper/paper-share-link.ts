import { NATIVE_WRITER, type PaperId } from "@workspace/domain"
import { useRunCommand } from "@/lib/contract-client.ts"
import { publicShareUrl } from "@/lib/web-origins-env.ts"

export function useShareLink(docId: PaperId) {
  const run = useRunCommand()
  return async () => {
    const { token } = await run("paper.share", { docId, writer: NATIVE_WRITER })
    return publicShareUrl(token)
  }
}
