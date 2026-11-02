import { useRunCommand } from "@/lib/contract-client.ts"
import { publicShareUrl } from "@/lib/web-origins-env.ts"

export function useShareLink(docId: string) {
  const run = useRunCommand()
  return async () => {
    const { token } = await run("paper.share", { docId })
    return publicShareUrl(token)
  }
}
