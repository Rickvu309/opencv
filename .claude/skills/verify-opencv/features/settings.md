# Settings

Six sections outside the app shell. Back to app returns to the start page. Sign in first (`auth.md`). Do not delete the only account of the run.

## Path

1. From any page in the shell, open the sidebar footer menu (the button showing the account email) and choose the menuitem Settings.
2. Preferences is the current section. Confirm Back to app, and the six sections: Preferences, Coach, Integrations, Usage & limits, Billing, Account.
3. Open Coach. Weekly plan reads Disabled. Activate it. Reload. The row stays Enabled.
4. Open Integrations. Gmail and Google Calendar read Disabled. Connect Gmail is the only glow. Activate it and confirm the page explains that this build cannot connect. Do not complete an OAuth redirect.
5. Open Usage & limits. Confirm a week percent, or the sentence "No weekly cap on this mode." Upgrade to Pro is outline. Activate it.
6. The upgrade placeholder shows "Billing is not open yet." There is no card field and no input named card. Back to billing returns to Billing.
7. Billing shows Free plan, Upgrade now as the only glow, "No card added", and "None yet".
8. Open Account. Export downloads `opencv-export.json` and toasts "Export started".
9. Open Delete account. Type `DELE`. The Delete account button stays disabled. Press Escape. The drawer closes. Do not type DELETE and do not confirm.
10. At 390px wide, the six links collapse into a select named Section. Nothing clips.

## Proof

- Screenshot `settings.png` of Preferences at 1440.
- Screenshot the upgrade placeholder and the delete drawer with `DELE` typed.
- The export response is the JSON file. Record the filename.
- Reload after the Weekly plan toggle and read `agentWeekly` back from `GET /api/profile`.

## Not this recipe

Do not submit a card, do not call `profile.setPlan`, and do not finish account deletion.
