"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { flushState } from "@/lib/actions/persistence";
import { useT } from "@/lib/i18n/use-t";

/**
 * Sign out, from the account menu.
 *
 * ## Why the queue is flushed first
 *
 * Writes to the account's row are coalesced, so at the moment somebody clicks
 * this there may be a change that has not been sent yet. Signing out first
 * would end the session and the pending write would be refused, which is the
 * user losing the last thing they typed at the exact moment they were told
 * their work is saved. So: flush, then close the door.
 *
 * ## Why the page is replaced rather than routed
 *
 * A client navigation would keep the store, and the store is holding the
 * account's state. AC-ACCT-003.1 says signing out stops showing the account's
 * data, and the only way to be sure of that is to throw the tab's memory away
 * with a real navigation.
 */
export function SignOutItem() {
  const { t, m } = useT();
  const [busy, setBusy] = React.useState(false);

  return (
    <DropdownMenuItem
      disabled={busy}
      onSelect={(event) => {
        // The menu would otherwise close and unmount this before the request
        // is made.
        event.preventDefault();
        if (busy) return;
        setBusy(true);

        flushState();
        void fetch("/api/auth/sign-out", { method: "POST" })
          .catch(() => {
            // The row may or may not be gone. Leaving anyway is still right:
            // the person asked to be signed out, and the next request with a
            // dead-or-alive cookie lands on a page that decides properly.
          })
          .finally(() => window.location.assign("/"));
      }}
    >
      {busy ? <Spinner /> : <LogOut />}
      {t(m.auth.signOut)}
    </DropdownMenuItem>
  );
}
