"use client";

import { Link, usePathname } from "@/lib/nav";
import { CoachBox } from "@/components/brand/coach-box";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

const productPrefixes = [
  "/coach",
  "/profile",
  "/paper",
  "/pitch",
  "/search",
  "/applications",
  "/settings",
  "/help",
];

export function ScreenNotice({
  title,
  body,
  action,
  href = "/coach",
}: {
  title: string;
  body: string;
  action: string;
  href?: string;
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <CoachBox size="lg" className="text-foreground" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-pretty text-foreground">{body}</p>
      <Button asChild className="mt-5">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

export function NotFound() {
  const { t, m } = useT();
  const pathname = usePathname();
  const inProduct = productPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (inProduct) {
    return (
      <ScreenNotice
        title={t(m.support.notFoundTitle)}
        body={t(m.support.notFoundBody)}
        action={t(m.support.notFoundAction)}
        href="/coach"
      />
    );
  }

  return (
    <ScreenNotice
      title={t(m.support.notFoundTitle)}
      body={t(m.support.notFoundPublicBody)}
      action={t(m.support.notFoundPublicAction)}
      href="/"
    />
  );
}
