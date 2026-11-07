import { useReducer } from "react"
import { Button } from "@workspace/ui/components/button"
import { agentServerUrl } from "@/lib/connections-api.ts"
import { agentSnippets, type AgentSnippet } from "./snippets.ts"

type CopyState =
  | { status: "idle" }
  | { status: "copied"; id: AgentSnippet["id"] }
  | { status: "failed"; id: AgentSnippet["id"] }

type CopyAction =
  | { type: "copied"; id: AgentSnippet["id"] }
  | { type: "failed"; id: AgentSnippet["id"] }

function copyReducer(_state: CopyState, action: CopyAction): CopyState {
  if (action.type === "copied") return { status: "copied", id: action.id }
  return { status: "failed", id: action.id }
}

export function ConnectAgent() {
  const snippets = agentSnippets(agentServerUrl)
  const [copy, dispatch] = useReducer(copyReducer, { status: "idle" })

  async function onCopy(snippet: AgentSnippet) {
    try {
      await navigator.clipboard.writeText(snippet.text)
      dispatch({ type: "copied", id: snippet.id })
    } catch {
      dispatch({ type: "failed", id: snippet.id })
    }
  }

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
        {snippets.map((snippet) => {
          const copied = copy.status === "copied" && copy.id === snippet.id
          const failed = copy.status === "failed" && copy.id === snippet.id
          const label = copied
            ? "Copied"
            : failed
              ? "Could not copy"
              : `Copy ${snippet.title}`
          return (
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
                <Button
                  type="button"
                  className="h-11 shrink-0 md:h-9"
                  variant="outline"
                  onClick={() => void onCopy(snippet)}
                >
                  {label}
                </Button>
              </div>
              <pre className="overflow-x-hidden rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {snippet.text}
              </pre>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
