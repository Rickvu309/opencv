# opencv page patterns

How to write an opencv page when no registry screen shares its layout, and how to build its states. Imports below use the default paths from `opencv.json` (`src/components/opencv`, `src/app`); adjust them to the project's config.

## Page skeleton

Every app page renders inside `AppFrame`, which brings the sidebar, the rounded main panel, the bottom dock and the mobile drawer.

```tsx
import { Plus, List, Kanban } from "lucide-react"
import { PageHeader, Toolbar } from "../components/opencv/shell"
import { Button } from "../components/opencv/button"
import { AppFrame, RouterLink } from "../app/app-frame"

const TABS = [
  { label: "Board", href: "/apply", icon: <Kanban /> },
  { label: "List", href: "/apply/list", icon: <List /> },
]

export default function Saved() {
  return (
    <AppFrame dock={["Tailor your CV"]}>
      <PageHeader title="Saved jobs">
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="size-3.5" />}
        >
          New job
        </Button>
      </PageHeader>
      <Toolbar tabs={TABS} active="/apply/list" link={RouterLink} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 py-6">
        {/* body */}
      </div>
    </AppFrame>
  )
}
```

- The header is 52 tall, the toolbar 44. A detail page swaps `PageHeader` for `DetailHeader` (breadcrumb, position, previous and next).
- The body owns its scroll (`min-h-0 flex-1 overflow-y-auto`). The shell never scrolls.
- Settings pages use `SettingsLayout` instead of `AppFrame`; copy `opencv screen settings` and add a section.
- Sign-in and other pages outside the app skip `AppFrame`.

## Which pieces for which page

| Page                    | Copy from   | Main pieces                                                                |
| ----------------------- | ----------- | -------------------------------------------------------------------------- |
| Board of items by stage | apply-board | `BoardLane`, `JobCard`                                                     |
| Grouped list            | apply-list  | `ListGroup`, `JobRow`                                                      |
| Item with properties    | job-detail  | `DetailHeader`, `RailSection`, `Property`, `ChecklistItem`, `ActivityItem` |
| Messages                | inbox       | `InboxRow`, reading pane                                                   |
| Chat with Coach         | coach       | `Composer`, `UserMessage`, `CoachMessage`, `Steps`, `ResultCard`           |
| Library of documents    | paper       | `PaperCard`, `NewPaperCard`, `SectionHead`, `SearchInput`                  |
| Document editor         | paper-doc   | `PaperPage`, `CvSection`, `CvEntry`                                        |
| Settings section        | settings    | `SettingsSection`, `SettingsCard`, `SettingsRow`, `Switch`, `Status`       |
| Not built yet           | jobs        | `StateMessage` with a faded peek                                           |

## States

A page is finished when each state it can reach is built. Copy stays short: a 2 to 4 word title, one line, one action.

- **Empty.** `StateMessage` with a lucide icon, a title that names the place, one line on how to fill it, one action.
  ```tsx
  <StateMessage
    icon={<Kanban />}
    title="No jobs yet"
    action={
      <Button variant="secondary" size="sm">
        Add a job
      </Button>
    }
  >
    Save a job to track it here.
  </StateMessage>
  ```
- **No results.** Name the query and offer the way out: "No results for "design"" with a Clear search button.
- **Loading.** `Skeleton` blocks shaped like the content (`<Skeleton className="h-4 w-48" />`), never a page spinner.
- **Error.** Page level: `StateMessage tone="error"` with a Try again action. Inside a page: `Banner tone="danger"` with one action.
- **Validation.** `Field` with `error`, `Input invalid`. Validate on submit, keep the submit button enabled, focus the first invalid field. Every required field gets its own message.
  ```tsx
  <Field label="Email" error={error}>
    {(id, d) => (
      <Input
        id={id}
        aria-describedby={d}
        invalid={!!error}
        type="email"
        autoComplete="email"
      />
    )}
  </Field>
  ```
  Put `noValidate` on the `<form>` so the browser bubble does not hide the inline message.
- **Success.** `const toast = useToast(); toast({ tone: 'success', message: 'Job added to Saved' })`. One fact, past tense.
- **Delete.** `ConfirmDelete`, then remove the item and toast with `action: { label: 'Undo', onClick: restore }`.
- **Limits.** At the Free limit, a `Banner` with the reset time and a Pro line; the rest of the app keeps working.

## Overlays

- `Dialog` closes on Escape and outside click, focuses the element marked `data-autofocus` (else the first control), and restores focus on close. Put `data-autofocus` on the first field of a form dialog, and on Cancel in a destructive one.
- `Menu` takes `onClose`; pass it for every popup menu so Escape, outside clicks and arrow keys work. Render the menu inside a `relative` wrapper with its trigger.
- Shortcuts shown with `kbd` must work: `⌘↵` submits a form dialog, `⌫` deletes from a menu.

## Theme classes

Run `opencv theme` for the full list. The ones you will use most:

- Surfaces: `bg-surface` (white panels), `bg-canvas` (settings and document desk), `bg-sidebar`, `bg-subtle` and `bg-hover` (row hover), `bg-active` (selected nav), `bg-chip`.
- Text: `text-fg`, `text-fg-2` (secondary), `text-fg-3` (meta), `text-placeholder`. Sizes: `text-caption`, `text-small`, `text-body` (13, the default), `text-title`, `text-h2`, `text-page`.
- Lines: `border-border`, `border-border-strong`; hairlines as `border-b-[0.5px]` or `ring-[0.5px] ring-border`.
- Radii: `rounded-chip` 4, `rounded-row` 6, `rounded-btn` 7, `rounded-tile` 8, `rounded-card` 10, `rounded-panel` 12, `rounded-media` 16.
- Meaning: `text-success`, `text-danger`, `text-info`, `text-indigo`, the `-soft` backgrounds, `text-stage-*`.
- Glow: `glow-button`, `glow-card`, and one `glow-<area>` per product area (`glow-paper`, `glow-apply`, `glow-coach`, ...), with `shadow-glow`.
- Lucide icons sit at `size-3.5` in rows and buttons, `size-4` in headers.

## Phone width

`AppShell` turns the sidebar into a drawer below 768. Inside the page:

- Side rails stack under the content below `md` (`flex-col md:flex-row`, rail `w-full md:w-[288px]`).
- Toolbars and tab rows scroll sideways (`overflow-x-auto`, items `shrink-0`).
- Fixed widths get `max-w-full`; rows of fixed boxes use `min-w-0 flex-1`.
- Padding steps down: `px-5 md:px-12`.

## React patterns that keep components correct

- An effect that subscribes to document events reads callbacks through a ref, so a parent's inline arrow does not re-run it on every render:
  ```tsx
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    /* use close.current() */
  }, [open])
  ```
- Demo data lives in `src/app/data.tsx`. Replace it with real data at the screen level; components take plain props.
