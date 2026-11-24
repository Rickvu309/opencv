---
status: accepted
---

# Control knows actors and never a context

Control runs every command, approval and Undo for the web app, the Coach and a person's own agents. It had come to import Apply, Chat and Coach, and it reached Coach through deferred imports to avoid a load cycle. A public read ran as a person named public.

Control knows who is asking and what the command's own definition says about it. It imports no context. What varies by command lives in the command's definition, where the context that owns it writes it. The actors are the Person, the Coach, a Delegate and a Visitor, who is not signed in and reads only what a person chose to share.

## Considered options

- Ports from Control to each context: one adapter each, so they would add indirection and no choice.
- An event bus between contexts: not needed for five references.

## Consequences

- A context registers its commands with Control when the app is wired.
- No code invents a person to pass a permission check.
- Showing a proposal in a Chat belongs to Coach, not Control.
