# @workspace/ui

Stock shadcn names, with the opencv design values (release-one ADR-0006). No new token. The glow primary is the `glow` utility and `Button` `variant="glow"`. The default variant is the kit secondary (surface, inset border). Screens opt into the glow one view at a time.

## Values

Kit token, stock variable, value. Grays are the light theme. `.dark` uses the sign-in panel grays and the same status hues, except `--destructive`, which stays the kit danger on the dark panel. `--primary` stays ink for badges and dots. The button mesh is `color-mix` of `--ring`, `--chart-1` and `--chart-3` on `--background`, so the utility adds no variable and no hex.

| Kit token                       | Stock variable                 | Value                                                                                                                                                              |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ds-bg-canvas                    | `--background`                 | `#F9F9FA` / `oklch(0.982 0.001 286.376)`                                                                                                                           |
| ds-text-primary                 | `--foreground`, `--primary`    | `#1A1A1A` / `oklch(0.218 0 0)`                                                                                                                                     |
| ds-bg-surface                   | `--card`, `--popover`          | `#FFFFFF` / `oklch(1 0 0)`                                                                                                                                         |
| ds-bg-subtle                    | `--secondary`                  | `#F4F4F5` / `oklch(0.967 0.001 286.375)`                                                                                                                           |
| ds-bg-chip                      | `--muted`                      | `#F0F0F0` / `oklch(0.955 0 0)`                                                                                                                                     |
| ds-text-secondary               | `--muted-foreground`           | `#59595B` / `oklch(0.465 0.003 286.275)`                                                                                                                           |
| ds-bg-hover                     | `--accent`, `--sidebar-accent` | `#E8E8E9` / `oklch(0.931 0.001 286.374)`                                                                                                                           |
| ds-danger                       | `--destructive`                | `#CE3B40` / `oklch(0.572 0.183 23.679)` on light text. 4.62:1 on `--background`, 4.86:1 on `--card`. `.dark` keeps the kit `#EB5757` / `oklch(0.653 0.183 23.679)` |
| ds-border                       | `--border`, `--sidebar-border` | `#E2E2E2` / `oklch(0.913 0 0)`                                                                                                                                     |
| ds-border-strong                | `--input`                      | `#CFCFD2` / `oklch(0.855 0.004 286.313)`                                                                                                                           |
| ds-focus, ds-label-indigo       | `--ring`, `--sidebar-ring`     | `#6D78D5` / `oklch(0.607 0.141 276.281)`                                                                                                                           |
| ds-info                         | `--chart-1`                    | `#5D85FF` / `oklch(0.649 0.186 267.396)`                                                                                                                           |
| ds-stage-interview              | `--chart-2`                    | `#3FA66B` / `oklch(0.650 0.130 154.934)`                                                                                                                           |
| ds-stage-offer                  | `--chart-3`                    | `#5E6AD2` / `oklch(0.567 0.159 275.206)`                                                                                                                           |
| ds-stage-applied                | `--chart-4`                    | `#E2A400` / `oklch(0.758 0.156 81.298)`                                                                                                                            |
| ds-stage-saved, ds-stage-closed | `--chart-5`                    | `#A0A0A2` / `oklch(0.706 0.003 286.326)`                                                                                                                           |
| ds-bg-sidebar                   | `--sidebar`                    | `#EFEFF0` / `oklch(0.952 0.001 286.375)`                                                                                                                           |
| ds-font                         | `--font-sans`                  | Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif                                                                                                        |
| sign-in panel                   | `.dark --background`           | `#0B0C10` / `oklch(0.155 0.009 274.276)`                                                                                                                           |
| sign-in card                    | `.dark --card`                 | `#15171E` / `oklch(0.206 0.014 272.582)`                                                                                                                           |

`--chart-2` is the interview stage (`text-chart-2` on the stage icon). `ds-success` is `#4CB782` and has no stock variable. `--chart-4` is the applied stage. `ds-warning` is `#CC9F00` and has no stock variable. Saved and closed share `--chart-5`. Light `--destructive` is the kit danger hue darkened so 14px text clears 4.5:1. The kit danger `#EB5757` stays on `.dark`.

Motion stays `--duration-micro` 150ms with `--ease-micro`, and `--duration-panel` 280ms with `--ease-panel`.

## Parts

`Brand`, `Mark`, `StageIcon`, `Field`, `ConfirmDelete`, `Meter`, `UsageBar`, `PageHeader`, `Toolbar`, and `Toaster` (`toastWithUndo`). Each has `data-slot` and is built on the package primitives. Import `@workspace/ui/components/<name>`.

`toastWithUndo(message, onUndo)` renders a Sonner toast whose action is Undo.
