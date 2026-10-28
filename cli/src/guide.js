export const GUIDE = `opencv: building real product screens with the opencv design system

Stack: React 19 + TypeScript + Tailwind CSS v4 + react-router 7 + lucide-react.
Components are copied into the project as source (shadcn style). You own and edit them.

1. Set up
   New app:        opencv new my-app --install && cd my-app && npm run dev
   Existing app:   opencv init, then follow the printed steps; opencv doctor to check

2. Start from a screen, not a blank file
   opencv list screens             apply-board, apply-list, apply-calendar, job-detail, inbox,
                                   coach, paper, paper-doc, jobs, settings, sign-in
   opencv screen apply-board       copies the screen + every component it uses, prints routes
   Copy the closest screen, then change data and layout. Keep the AppFrame wrapper.

3. Build with the components
   opencv list components          button, field, choice, display, feedback, overlay, shell,
                                   apply, inbox, coach, settings, paper, brand
   opencv show JobCard             exports, props notes;  --source for the code
   opencv add Button Dialog        copy files (dependencies come along)
   Use theme classes, not raw values: bg-surface bg-canvas bg-subtle text-fg text-fg-2 text-fg-3
   border-border rounded-btn rounded-card text-body text-small glow-button shadow-glow

4. Check before you say done
   npm run build                   must pass with no type errors
   opencv lint                     brand, em dash, middle dot, orange, warm tints, black buttons
   Open the page at 1440 and 375 wide. Walk every state with the keyboard:
   empty, loading, error, each form submitted empty, each dialog and menu, each toast.

Non-negotiables
- Grayscale app. Color only for meaning: StageIcon, MapPin text-info, Calendar text-indigo, success, danger.
- No orange or red "needs you" dots. No warm tints.
- Primary is <Button variant="primary"> (the glow), one per view. variant="danger" only to delete.
- Brand is <Brand /> or <Mark />. Never type "OpenCV".
- Headings 2 to 4 words. No em dash, no middle dot. On reads "Enabled", off reads "Disabled".
- Job title first, company second. Delete dialogs: <ConfirmDelete thing="..." confirmLabel="Delete job" />.
- The Coach <Composer> keeps the Free model pill.
`;

export const PEN_GUIDE = `opencv pen: building on the pen.dev canvas (opencv.pen)

The design source is opencv.pen. Read and edit it only through the pencil MCP tools
(get_app_state, execute). These commands print the JavaScript you pass to execute.

  opencv pen layouts                    the 10 page templates
  opencv pen screen board --name "W13.1 Saved jobs" --title "Apply" --action "New job"
  opencv pen ls / show button / find primary lg
  opencv pen snippet button primary --label "Add job" --parent <id>
  opencv pen glow button | opencv pen brand --lead "Welcome to"
  opencv pen lint dump.txt              lint a Print(JSON.stringify(Get(id, { depth: 30 }))) dump
  opencv pen sync --snippet / sync <file>   refresh the kit after masters change

Export a PNG after each section and look at it. Keep 600px between canvas parts.
`;
