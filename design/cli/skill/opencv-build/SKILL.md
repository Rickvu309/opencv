---
name: opencv-build
description: Build real opencv product screens and components in React code with the `opencv` CLI (opencv-kit). Use when creating, extending or reviewing opencv app code, scaffolding an opencv app, or turning a design-kit screen into a working page. For the pen.dev canvas use opencv-pen.
---

# Building opencv screens in code

opencv ships as source, shadcn style: `opencv` copies components and whole screens into the project, and the project owns them. Stack: React 19, TypeScript, Tailwind CSS v4, react-router 7, lucide-react. The registry is the design kit in code, so a screen built from it already matches the canvas.

The CLI is the source of truth for names and props. Look things up with it rather than guessing:

```
opencv list                  components and screens
opencv show <Export|file>    exports and usage notes   (--source for the code)
opencv rules [topic]         product decisions: copy, apply, coach, plans
opencv theme                 every theme class the kit defines
```

## Workflow

1. **Set up.** In a project with no `opencv.json`, run `opencv new <dir> --install` for a new app, or `opencv init` in an existing Vite + React app and follow what it prints. Done when `opencv doctor` prints only `ok` lines.
2. **Start from a screen.** Run `opencv list` and pick the registry screen closest to the request: board, list, calendar, detail, reading pane, chat, document, library, settings, auth. Done when you can name the screen you start from and what you will change. Write a page from nothing only when no screen shares its layout, and then follow [references/patterns.md](references/patterns.md).
3. **Copy it in.** `opencv screen <name>` copies the screen and every component it uses, then prints routes; add them to `src/main.tsx`. `opencv add <Export...>` brings single components. Keep the copied file's structure (AppFrame, header, toolbar, body) and change data, copy and sections.
4. **Compose.** Before using a component, run `opencv show` on it and follow its notes. Build every state the page can be in, from [references/patterns.md](references/patterns.md): empty, loading, error, validation, success, and the delete path when anything can be deleted.
5. **Check.** All four, in order:
   - `npm run build` passes with no type errors.
   - `opencv lint` reports 0 errors and 0 warnings.
   - Open the route in a browser at 1440 wide and at 375 wide. Nothing clips, overlaps or scrolls sideways.
   - Walk every state from step 4 with the keyboard: open and close each dialog and menu with Escape, submit each form empty, trigger each toast.

   Done when each check has been run and seen to pass. Report what you looked at.

## Shadcn target

The opencv repo sets `"target": "shadcn"` in `opencv.json`. Stock shadcn names stay. The kit's classes are rewritten onto them.

- `opencv doctor` prints only `ok` lines, including `target shadcn`, when Button, the Toaster, `globals.css`, sonner and the Tailwind plugin are in place.
- `opencv screen <name> --target shadcn --dry-run` prints residue and writes nothing. `hex` and `raw` are 0. `hand-finish` names the Google mark, renamed controls, and react-router hooks.
- `opencv screen <name> --target shadcn` writes the mapped files.
- `opencv lint <paths> --target shadcn` treats `bg-accent` as a hover surface. Orange is the reserved hex. Copy findings that the current app still has are warnings.

## House rules

These are settled. Apply them as written.

- **Brand.** Write it as `<Brand />` ("[mark] opencv", lowercase) or `<Mark />` alone. Pass `lead` for headings: `<Brand lead="Welcome to" size={30} />`.
- **Color.** Grayscale app on theme classes (`bg-surface`, `text-fg-2`, `border-border`, ...). Color carries meaning only: `StageIcon`, the blue location pin (`text-info`), the indigo calendar (`text-indigo`), `success`, `danger`. Unread and needs-you markers are a dark dot. Backgrounds stay cool neutral gray.
- **Buttons.** `<Button variant="primary">` is the glow and appears once per view. `secondary` for the rest, `ghost` in headers and toolbars, `danger` only for delete. Labels start with a verb and name the result: "Add job", "Delete job".
- **Copy.** Headings 2 to 4 words, sentence case, one short helper line. Commas, periods or "to" where a dash or middle dot might go. Toggles read "Enabled" and "Disabled". Job title first, company second. Errors say how to fix: "Use a full email, like name@example.com".
- **Delete.** `<ConfirmDelete thing="Associate PM intern" confirmLabel="Delete job" />`, then a toast with an Undo action.
- **Coach.** The `<Composer>` keeps its Free model pill. Usage shows as percentages through `UsageBar` and `Meter`. Plans are Free and Pro ($9).
- **Edit the copied component** when it needs to change, and keep its doc comment true. A one-off variant in a screen file drifts from the kit.

`opencv lint` checks the brand spelling, dashes, middle dots, orange, warm tints and black buttons. It cannot see layout or states, which is why step 5 opens the browser.
