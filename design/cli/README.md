# opencv-kit

Build real opencv product screens in React, on the design system. `opencv` copies components and whole screens into your app as source (shadcn style), generates the Tailwind theme from the kit tokens, and lints your code against the decisions the team made. Built for agents, useful for people.

- **11 screens, 16 routes:** Apply board, list and calendar, job detail, Inbox, Coach, Paper library and document, Jobs, Settings (6 sections), Sign in.
- **14 component files, 70+ components:** shell, buttons, fields, choices, display, feedback, overlays, Apply, Inbox, Coach, Settings, Paper, brand.
- **Every state built:** empty, loading, error, validation, toasts with Undo, delete confirmation, keyboard and phone width.
- **On-system by default:** glow primary buttons, grayscale with color only for meaning, the "[mark] opencv" brand, the writing rules.

Stack: React 19, TypeScript, Tailwind CSS v4, react-router 7, lucide-react, Inter. The CLI itself has no dependencies; Node 18 or later.

## Install

```bash
npm install -g ./opencv-kit-2.0.0.tgz
```

That gives you `opencv` (and the alias `ocv`). Then install the Claude skills so agents use it on their own:

```bash
opencv skill --install
```

`opencv-build` covers product code; `opencv-pen` covers the pen.dev canvas.

## New app

```bash
opencv new my-app --install
cd my-app
npm run dev
```

Open http://localhost:5173/apply. Every screen is wired up with demo data in `src/app/data.tsx`.

## Existing app

In a Vite + React project:

```bash
opencv init
opencv doctor
```

`init` writes `opencv.json`, `src/styles/opencv.css` and the base components, then prints the npm installs and the two lines to add (Tailwind plugin, `ToastProvider`). `doctor` checks each one.

## Shadcn target

The opencv app keeps stock shadcn variable names. Set `"target": "shadcn"` in `opencv.json`, with `componentsDir` on the shared UI package and `screensDir` on the app features.

```bash
opencv doctor
opencv screen apply-board --target shadcn --dry-run
opencv lint apps/web/src packages/ui/src --target shadcn
```

`doctor` then checks the Button file, the single Toaster mount, `globals.css`, the sonner dependency and the Tailwind plugin. It prints only `ok` lines, including `target shadcn`.

`--dry-run` prints the residue and writes nothing. `hex` and `raw` are 0 when the map covers the screen. `hand-finish` names the Google mark colors, controls renamed onto `Button`, `Input`, `Textarea` and `Select`, and react-router hooks that now import `@tanstack/react-router`.

`opencv screen <name> --target shadcn` writes that mapped source. Under this target, `orange-accent` keys on the reserved orange hex. `bg-accent` is the stock hover surface. Copy rules that the current app still violates are warnings, so lint can report 0 errors.

Then bring in what you need:

```bash
opencv screen apply-board job-detail   # screens plus every component they use; prints the routes
opencv add Button ConfirmDelete         # single components by export or file name
```

Files land where `opencv.json` says (defaults: `src/components/opencv`, `src/screens`, `src/app`). Existing files are kept unless you pass `--force`.

## Commands

| Command                      | What it does                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `guide`                      | The agent playbook.                                                          |
| `new <dir> [--install]`      | A complete app with every screen.                                            |
| `init [--force]`             | Add opencv to an existing React project.                                     |
| `doctor`                     | Check the setup. A shadcn `opencv.json` checks Button, Toaster, globals.css and sonner. |
| `list [components\|screens]` | What you can add. `--json` for agents.                                       |
| `show <name> [--source]`     | A component file, export or screen: exports, notes, dependencies, code.      |
| `add <names...> \| --all`    | Copy components with their dependencies.                                     |
| `screen <names...>`          | Copy screens with everything they use and print the routes. `--target shadcn` maps classes. `--dry-run` prints residue. |
| `theme`                      | Print `opencv.css`: the Tailwind v4 `@theme`, glow utilities and base layer. |
| `lint [paths...]`            | Lint your code. Exits 1 on errors. `--target shadcn` keys orange on the hex. `--json`, `--verbose`. |
| `copy "<text>"`              | Writing rules on one string.                                                 |
| `rules [topic]`              | Product decisions: brand, color, buttons, copy, layout, apply, coach, plans. |
| `tokens`, `export <dir>`     | Raw design tokens and a hand-off bundle.                                     |
| `skill [--install [dir]]`    | Print or install the Claude skills.                                          |
| `pen <command>`              | pen.dev canvas tools. `opencv pen --help`.                                   |

## Lint rules

`opencv lint` reads `.tsx .ts .jsx .js .css .html .mdx`, skips comments, and checks class names, hex values, string literals and JSX text.

| Rule                                  | Level   | Catches                                                                       |
| ------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `brand-name`                          | error   | "OpenCV" in copy. Use `<Brand />`.                                            |
| `em-dash`, `middle-dot`               | error   | `—` and `·` in copy.                                                          |
| `orange-accent`                       | error   | The reserved orange. On `--target shadcn`, the hex only. `bg-accent` stays a hover surface. |
| `warm-tint`                           | error   | Peach, beige and orange hex values.                                           |
| `black-primary`                       | error   | Black buttons with white labels. Primary is `<Button variant="primary">`.     |
| `oops`                                | error   | "Oops" in copy.                                                               |
| `font`                                | warning | A font family other than Inter.                                               |
| `connected`, `exclamation`, `credits` | warning | Copy rules: "Enabled" for on states, no exclamation marks, no credit numbers. |
| `raw-hex`                             | hint    | A hex value with a theme class available. Shown with `--verbose`.             |

Lint cannot see layout or states. Open the page at 1440 and 375 wide and walk each state.

## Develop

```bash
npm test          # pen tooling, registry, theme, lint, the shadcn target, new and init
npm pack          # rebuilds the kit, runs the tests, writes opencv-kit-<version>.tgz
```

The registry lives in `registry/`: `components/`, `screens/`, `app/` (frame and demo data) and `public/logos/`. Inside it, imports use `~components/<file>` and `~app/<file>`; the CLI rewrites them to relative paths on copy. A new export is picked up by `list` and `show` automatically; a doc comment right above it becomes its note in `show`. A new screen needs an entry in `SCREENS` in `src/code/registry.js`.

The pen.dev side reads `data/kit.json`, built from `opencv.pen` with `opencv pen sync`.
