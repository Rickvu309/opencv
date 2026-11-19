import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@workspace/ui/components/code-block"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
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
              <p className="max-w-[60ch] text-sm text-muted-foreground">
                {snippet.detail}
              </p>
              {snippet.more ? (
                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="inline-flex min-h-11 items-center gap-1 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-6">
                    {snippet.more.title}
                    <CollapsibleIndicator className="size-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="max-w-[60ch] pt-3 text-sm text-muted-foreground">
                      {snippet.more.body}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
            {snippet.copies.map((copy) => (
              <div key={copy.id} className="flex flex-col gap-2">
                <CodeBlock size="sm">
                  <CodeBlockHeader>
                    <CodeBlockTitle>{copy.label}</CodeBlockTitle>
                    <CodeBlockActions>
                      <CodeBlockCopyButton
                        aria-label={copy.button}
                        value={copy.text}
                      />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                  <CodeBlockContent wrap>{copy.text}</CodeBlockContent>
                </CodeBlock>
                {copy.tip ? (
                  <p className="text-sm text-muted-foreground">{copy.tip}</p>
                ) : null}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
