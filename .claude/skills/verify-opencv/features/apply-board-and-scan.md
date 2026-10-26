# Apply board, list, calendar, and detail

Apply (`/app/apply`) is a board with columns Saved, Applied, Interview, and Offer. Closed stays behind Hidden columns. A new account has no jobs. New job pastes a posting link. In verification the posting fetch is a stub, so no network is used.

## Sub-features

- `apply-board` shows Track your first job before the first job, then the four columns.
- `apply-preview` fills title and company from a posting URL.
- `apply-add` adds the job. The stub posting lands in Saved.
- `apply-move` moves a card onto Interview and keeps it there after reload.
- `apply-detail` shows the posting and keeps a note after reload.

## How to get to it (user POV)

- Choose Apply in the sidebar.
- Choose New job, paste a posting link, then Add job.
- Drag a card to another column, or open the job and change Stage.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The board has no jobs. `AGENT_BROWSER_SESSION=verify-376`.

- **Board.** `agent-browser open "$WEB_URL/app/apply"`. The page shows Track your first job. Closed is not visible. Create two jobs with `POST /api/commands/job.create`: Associate PM intern at Local startup in `interview`, and Business Analyst at Regional bank in `applied`. Reload. Those titles sit under Interview and Applied.
- **Move.** Drag the Business Analyst card onto the Interview lane. Reload. It stays under Interview. `GET /api/jobs` shows `stage` `interview` for that job.
- **Preview.** `agent-browser find role button click --name "New job"`, fill the link textbox with `https://careers.verify-posting.dev/associate-pm-intern`, then `agent-browser find role button click --name "Paste"`. Wait 3 s. The dialog shows Filled, Associate Product Manager Intern, and Northwind Labs. Choose Add job. Saved holds that card.
- **Detail.** Open the new card. The posting text is on the page. Leave a note `Bring the checkout study.` and submit Add note. Reload. The note is in the activity list.
- **390 and reduced motion.** Screenshot both widths. Proof images go to `$EVIDENCE_DIR`.

## Gotchas

- The verify stub answers every http URL with the Northwind posting, including a host the real guard would refuse. Pasting a link cannot show "Add the company name to save this job." The dialog unit test covers that sentence. `jobs.example.com` stays refused in `openableApplyJobUrl` when fetch is real.
- The stub ignores the path and returns the Northwind sentence: `Northwind Labs is hiring an Associate Product Manager Intern in Hanoi.` A second add of the same URL shows Already on your board.
- The browser must not fetch the posting URL. Preview goes through `POST /api/jobs/preview`.
- Closed is hidden until Hidden columns. The old columns Inbox, Prep, Sent, and Live are gone.
