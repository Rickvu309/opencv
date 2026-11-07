import { CopyButton } from "@workspace/ui/components/copy-button"
import { agentServerUrl } from "@/lib/connections-api.ts"
import { agentSnippets } from "./snippets.ts"

export function ConnectAgent() {
  const snippets = agentSnippets(agentServerUrl)

  return (
    <section
      className="my-6 flex flex-col gap-3"
      aria-labelledby="connect-agent-title"
    >
      <h2 id="connect-agent-title" className="text-base font-medium">
        Connect an agent
      </h2>
      <p className="text-sm text-muted-foreground">
        Copy each step. Paste a command into a terminal, or paste a table into
        the file that step names. Then approve the connection here.
      </p>
      <p className="text-sm text-muted-foreground">Address</p>
      <code className="rounded-md bg-muted px-3 py-2 text-sm break-words">
        {agentServerUrl}
      </code>
      <ul className="flex flex-col gap-3">
        {snippets.map((snippet) => (
          <li
            key={snippet.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">{snippet.title}</p>
              <p className="text-sm text-muted-foreground">{snippet.detail}</p>
            </div>
            {snippet.copies.map((copy) => (
              <div key={copy.id} className="flex flex-col gap-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <p className="text-sm font-medium">{copy.label}</p>
                  <CopyButton
                    className="h-11 w-full shrink-0 md:h-9 md:w-auto"
                    variant="outline"
                    size="default"
                    aria-label={copy.button}
                    value={copy.text}
                  >
                    {copy.button}
                  </CopyButton>
                </div>
                <pre className="overflow-x-hidden rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">
                  {copy.text}
                </pre>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
