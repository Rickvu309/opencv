---
status: accepted
---

# The product contexts are the modules

OpenCV had modules by folder name and no statement of what a module is. Chat and Coach imported each other, and one change in any api module reached all seven.

The modules are the contexts in `GLOSSARY-MAP.md`: Account, Control, Paper, Apply, Inbox, Coach and Agents. A context owns its packs in the contract, the api and the web, and its own tables; `docs/packs.md` lists each pack. Some folders keep older names: Paper is `paper-doc` in the contract, Apply is `job` in the api, Agents is `connections`, and Control is the `registry` kernel. Its interface is its operations plus the few typed functions another context calls. Chat is part of Coach, because a Chat is a conversation with an agent and has no meaning without one.

## Considered options

- Modules by technical layer: every product change crosses every module.
- One package per context: a build and a version for each, for no gain over a checked folder.
- One vertical module across browser and server code: erases the line between code that runs in a browser and code that runs on a server.

## Consequences

- Each context owns its tables, and another context reaches its data only through its interface.
- The dependencies between contexts are declared and have no loop.
- Each context has a test that runs it with only the contexts it declares.
- A new part of the product arrives as a new context and edits no shared file beyond one line of wiring.
