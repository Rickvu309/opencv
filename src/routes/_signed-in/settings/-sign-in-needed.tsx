"use client";

import { Link } from "@/lib/nav";

import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export function SignInNeeded() {
  const { t, m } = useT();
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <EmptyState
        title={t(m.billing.signInTitle)}
        body={t(m.billing.signInBody)}
        action={
          <Button asChild>
            <Link href="/sign-in">{t(m.common.signIn)}</Link>
          </Button>
        }
        className="px-0 py-0"
      />
    </div>
  );
}
