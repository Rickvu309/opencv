import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { readProofPage, readSiteForAccount } from "@/lib/paper/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await readProofPage(slug);
  if (!page) return { title: "Proof" };
  return {
    title: page.snapshot.title || "Proof",
    description: page.snapshot.role || page.snapshot.notes[0]?.text.slice(0, 160),
    openGraph: {
      title: page.snapshot.title || "Proof",
      description: page.snapshot.role || undefined,
    },
  };
}

export default async function ProofSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await readProofPage(slug);
  if (!page) notFound();

  const site = await readSiteForAccount(page.accountId);
  const { snapshot } = page;

  return (
    <main className="min-h-svh bg-[#f6f1e8] text-[#1a1714]">
      <article className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs tracking-[0.2em] uppercase text-[#6b645c]">Proof</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-pretty">
          {snapshot.title || "Untitled Proof"}
        </h1>
        <p className="mt-3 text-sm text-[#6b645c]">
          {[snapshot.role, snapshot.dates].filter(Boolean).join(" · ")}
        </p>
        {snapshot.link && (
          <p className="mt-2">
            <a href={snapshot.link} className="text-sm underline underline-offset-4">
              {snapshot.link}
            </a>
          </p>
        )}
        <ol className="mt-10 space-y-6">
          {snapshot.notes.map((note, index) => (
            <li key={`${note.at}-${index}`}>
              <p className="whitespace-pre-wrap text-lg leading-relaxed">{note.text}</p>
              <p className="mt-2 text-xs tabular-nums text-[#6b645c]">{note.at}</p>
            </li>
          ))}
        </ol>
        <footer className="mt-16 flex items-center justify-between gap-4 border-t border-[#1a1714]/10 pt-6 text-xs text-[#6b645c]">
          <span>OpenPath</span>
          {site && (
            <Link href={`/u/${site.handle}`} className="underline underline-offset-4">
              More from this person
            </Link>
          )}
        </footer>
      </article>
    </main>
  );
}
