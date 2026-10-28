# Inbox

Mail surface on the fake fixture. Sign in first (`auth.md`). A new account has not skipped and has not scanned. Do not drive Gmail OAuth. That path stays not driven until `GOOGLE_CLIENT_ID` is set.

## Path

1. Open `/app/inbox`. The heading is Inbox. The connect screen says Never miss a recruiter reply. Connect Gmail is a white button with the Gmail mark. It is disabled, and the page says Gmail is not connected on this server. You can skip for now. Skip for now is present.
2. Activate Skip for now. The page says No job emails yet and offers a ghost button Scan. Connect Gmail is gone. Skip does not scan.
3. Activate Scan. The page says Finding your job emails, then a count of emails and companies, then the list. On a desktop width nothing is open and the right pane says 4 unread. The list header has no unread count. The rows are Business Analyst, Associate PM, Marketing Executive, Growth Marketer, Content Specialist, and Product Analyst, in that order.
4. Activate Scan again. The list still has six rows.
5. Create a job through `job.create` with title Associate PM, company Local startup, and stage applied. Activate Scan. Open the Associate PM row. The reader says Linked to Associate PM in Apply and Move this job to Interview? The prompt reads Move this job from Applied to Interview? and Move to Interview is its button.
6. Activate Move to Interview. The toast says Moved to Interview and offers Undo. Reload `/app/apply`. The job is in Interview.
7. Activate Undo. Reload `/app/apply`. The job is in Applied.
8. Open the Business Analyst row. Thu 14:30 is pressed in the reply card. Thu 15:00, Suggest another time, Send, and Add to calendar are present. Send is the dark button. The first paint does not send.
9. Activate Send. The toast says Reply sent. The reply body is in the reader. Reload. The reply is still there.
10. Activate Add to calendar. The toast says Added to calendar.
11. Activate Done. The toast says Marked done and offers Undo.
12. Activate Snooze. The toast says Snoozed until 7:00.
13. Open in Gmail is present and disabled. Its description says Gmail is not connected.
14. At 390px the list is the screen. Opening a row shows the reader and Back to inbox.
15. With reduced motion, the scanning tiles do not pulse.

## Proof

- Screenshot `inbox-connect.png` at 1440 before Skip.
- Screenshot `inbox-list.png` at 1440 after Scan, and `inbox-reader-move.png` on Associate PM.
- Screenshot `inbox-reader-draft.png` on Business Analyst before Send, and `inbox-sent.png` after reload.
- Screenshot `inbox-390.png` of the list and `inbox-390-reader.png` with Back to inbox.
- Screenshot `inbox-reduced.png` of the scanning tiles with reduced motion.
- Read `GET /api/inbox` after the second scan and confirm six threads.
- Read `GET /api/jobs` after the move and after Undo.

## Not this recipe

Do not open the Gmail OAuth URL. Do not send a reply except by activating Send. Do not call a model on the first paint of the draft.
