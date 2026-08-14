"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n/use-t";

export function SignInNeeded() {
  const { t, m } = useT();
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/sign-in" className="underline underline-offset-4">
          {t(m.common.signIn)}
        </Link>
      </p>
    </div>
  );
}
