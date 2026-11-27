---
status: accepted
---

# Control knows actors and never a context

Control runs every command, approval and Undo for the web app, the Coach and a person's own agents. It had come to import Apply, Chat and Coach, and it reached Coach through deferred imports to avoid a load cycle. A public read ran as a person named public.

Control knows who is asking and what the command's own definition says about it. It imports no context. What varies by command lives in the command's definition, where the context that owns it writes it. The actors are the Person, the Coach, a Delegate and a Visitor, who is not signed in and reads only what a person chose to share.

## Considered options

- A port for everything Control needs from a context: most of it is a fact about one command, and that belongs in the command's definition.
- Passing a context's part as an argument to approve and deny: every direct caller would have to know which part to pass.
- An event bus between contexts: not needed for five references.

## Consequences

- Each command is an operation pair, and the generated catalog binds every pair to Control when the app is wired.
- No code invents a person to pass a permission check.
- Showing a proposal in a Chat belongs to Coach, not Control.
- A command that needs a version check on approval states its own basis. Apply does this for a Job's priority.
- Two steps run inside Control's approval in a fixed order and belong to Coach: locking and resolving a Coach task, and opening the Chat that holds a connected agent's proposal. Coach hands both to Control when it registers. Control refuses such a proposal when nothing is registered.
