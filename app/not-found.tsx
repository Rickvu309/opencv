"use client";

import Link from "next/link";

import { CoachBox } from "@/components/brand/coach-box";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export default function NotFound() {
  const { t, m } = useT();
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <CoachBox size="lg" className="text-foreground" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {t(m.support.notFoundTitle)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        {t(m.support.notFoundBody)}
      </p>
      <Button asChild className="mt-5">
        <Link href="/coach">{t(m.support.notFoundAction)}</Link>
      </Button>
    </div>
  );
}
