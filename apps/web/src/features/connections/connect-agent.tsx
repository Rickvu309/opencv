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
        Copy a command, paste it into your agent, then approve the connection
        here. That approval is the only step.
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
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{snippet.title}</p>
                <p className="text-sm text-muted-foreground">
                  {snippet.detail}
                </p>
              </div>
              <CopyButton
                className="h-11 shrink-0 md:h-9"
                variant="outline"
                size="default"
                aria-label={`Copy ${snippet.title}`}
                value={snippet.text}
              >
                {`Copy ${snippet.title}`}
              </CopyButton>
            </div>
            <pre className="overflow-x-hidden rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">
              {snippet.text}
            </pre>
          </li>
        ))}
      </ul>
    </section>
  )
}
