---
name: opencv-pen
description: Build, extend or review opencv designs on the pen.dev canvas (opencv.pen) with `opencv pen` commands. Use only for canvas work through the pencil MCP tools. For real product code use the opencv-build skill.
---

# opencv design with opencv-kit

The design source is `opencv.pen`. It is encrypted: read and edit it only through the pencil MCP tools (`get_app_state`, `execute`). The `opencv` CLI holds the kit (tokens, 305 masters with ids, specs, layouts, rules) and prints the JavaScript you pass to `execute`.

Run `opencv pen guide` once at the start of a task.

## Workflow

1. **Rules first.** `opencv rules` (or `opencv rules copy`, `color`, `buttons`, `apply`, `coach`). These are decisions the team already made. Do not re-litigate them.
2. **Layout.** `opencv pen layouts`, then `opencv pen screen <layout> --name "W13.1 Title" --title "..."`. Run the snippet with pencil `execute`; it prints the ids it created.
3. **Components.** `opencv pen ls`, `opencv pen show <component>`, then `opencv pen snippet <words> --parent <id>` to insert a ref to the exact master (for example `opencv pen snippet button primary --label "Add job"`). Never redraw a component that has a master.
4. **Values.** `opencv tokens` for ds-* tokens, `opencv pen glow <name>` for glow fills, `opencv pen brand` for the "[mark] opencv" heading.
5. **Check.** Export a PNG after each section and look at it. Then dump the frame with `Print(JSON.stringify(Get(id, { depth: 30 })))`, save the output, and run `opencv pen lint <file>`. Fix every error before reporting done.

## Non-negotiables

- Never write "OpenCV". The brand is the mark plus lowercase "opencv".
- Grayscale app. Color only for meaning. No orange or red dots. No warm tints.
- Primary button is the glow, never black. One per view.
- Headings 2 to 4 words. No em dash, no middle dot. "Enabled" / "Disabled".
- Job title first, company second. Stories never name a company.
- The Coach composer keeps the "Free ⌄" model pill.
- Screenshots keep 16:10 and are never cut on the sides.

## When the canvas changed

If `opencv snippet` points at a master that no longer exists, run `opencv pen sync --snippet`, execute it, save the full output to a file and run `opencv pen sync <file>`.
