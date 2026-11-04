# Coming soon, palette, and 404

Jobs, Proofs and Pitch are coming-soon pages. Notify me and Get early access store a row through `notify.request`. The command palette searches pages, jobs, paper and chats. Unknown paths and `/u/$slug` render one calm 404 action.

## Sub-features

- `jobs` shows the promise Jobs, matched to you, Notify me as the only glow, and Track a job in Apply.
- `proofs` shows Back your CV with proof and Get early access. `/proof` redirects here.
- `pitch` shows One link that sells you and Get early access.
- `palette` opens with Ctrl K or Cmd K. An empty query lists pages and recent chats. A job row shows the title, then the company, then the stage word.
- `not-found` says Page not found. Signed in, the 404 sits inside the shell and the action is Back to start. Signed out, the page is bare and the action is Go to sign in. An unknown path does not redirect.

## How to get to it (user POV)

- Choose Jobs, or open `/jobs`. Proofs is `/proofs`. Pitch is `/pitch`.
- Press Ctrl K anywhere in the shell.
- Open `/nothing` or `/u/someone` while signed in. The 404 is inside the shell. Signed out, those paths are the bare page.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). `run.env` loaded. Session `verify-<run>`. Do not write the sign-in code into the report.

- **Jobs.** `agent-browser open "$WEB_URL/jobs"`. The heading is Jobs, matched to you. Notify me is the only glow. Track a job in Apply is a link. The four preview rows are `aria-hidden`.
- **Notify.** Click Notify me. The toast is You're on the list. Click again. The toast is You're already on the list. Reload, click again, and the same toast returns. A second `notify.request` for jobs returns the same id.
- **Proofs.** Open `/proofs`. The heading is Back your CV with proof. Click Get early access.
- **Proof alias.** Open `/proof`. The URL becomes `/proofs`.
- **Pitch.** Open `/pitch`. The heading is One link that sells you. Click Get early access. There is no Publish button and no story dialog.
- **Palette.** Press Ctrl+k. The dialog is named Search. An empty query shows Apply and does not request `/api/search`. Create a job named Marketing Executive at Lumière Cosmetics, then type that title. The row name starts with the title and the properties strip shows the company and the stage word. Press Enter. The URL is `/apply`. Open the palette again and press Escape. Focus returns to Search.
- **404.** Open `/nothing`. The heading is Page not found, inside the shell, with one main. Click Back to start. The URL is the start page, `/apply` by default. `/u/someone` and `/nothing` show the same shell 404.
- **Signed out 404.** Sign out, open `/nothing`. The action is Go to sign in, the page is bare, and the URL stays `/nothing`. `/u/someone` does the same.
- **390.** `agent-browser set viewport 390 844`. Jobs does not scroll sideways. The palette is full screen.
- **Reduced motion.** `agent-browser set media reduced-motion reduce`, reload, and confirm no running animation.
- **Proof.** Screenshots `$EVIDENCE_DIR/jobs-soon.png`, `palette.png`, `404.png`.

## Gotchas

- The preview is a picture. Download CV and Email are not controls.
- The page name is the h1 in the 52px header. The promise is an h2.
- Empty palette search does not call `/api/search`.
- A chat row opens the shell panel. A job row goes to Apply, not to a job id.
