import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  listProofPages,
  loggedDays,
  readSite,
} from "@/lib/paper/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: handle };
}

export default async function PersonalLinkPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const site = await readSite(handle);
  if (!site) notFound();

  const pages = await listProofPages(site.accountId);
  const days = loggedDays(pages.map((page) => page.snapshot));

  return (
    <main className="min-h-svh bg-[#111110] text-[#f4efe6]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs tracking-[0.2em] uppercase text-[#9a9388]">
          /u/{site.handle}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">A record</h1>
        <p className="mt-2 text-sm text-[#9a9388]">
          Days something was logged. No streaks. No counts.
        </p>
        <ActivityCalendar days={days} />
        <ul className="mt-12 space-y-4">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/p/${page.slug}`}
                className="block rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                <span className="block text-sm font-medium">
                  {page.snapshot.title || "Untitled Proof"}
                </span>
                <span className="mt-1 block text-xs text-[#9a9388]">
                  {[page.snapshot.role, page.snapshot.dates].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-16 text-xs text-[#6b645c]">OpenPath</p>
      </div>
    </main>
  );
}

function ActivityCalendar({ days }: { days: string[] }) {
  const marked = new Set(days);
  const today = new Date();
  const cells: { key: string; on: boolean }[] = [];
  for (let i = 83; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    cells.push({ key, on: marked.has(key) });
  }

  return (
    <div
      aria-hidden
      className="mt-8 grid grid-cols-12 gap-1"
    >
      {cells.map((cell) => (
        <span
          key={cell.key}
          className={
            cell.on
              ? "aspect-square rounded-sm bg-[#f4efe6]"
              : "aspect-square rounded-sm bg-white/8"
          }
        />
      ))}
    </div>
  );
}
