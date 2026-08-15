import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProofArticle } from "@/components/paper/proof-article";
import { listProofPages, readProofPage, readSiteForAccount } from "@/lib/paper/share";
import { spanFromSnapshot } from "@/lib/paper/spans";

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
    description:
      page.snapshot.why ||
      page.snapshot.role ||
      page.snapshot.notes[0]?.text.slice(0, 160),
    openGraph: {
      title: page.snapshot.title || "Proof",
      description: page.snapshot.why || page.snapshot.role || undefined,
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
  const others = site
    ? (await listProofPages(page.accountId)).filter((item) => item.slug !== slug)
    : [];

  return (
    <main className="min-h-svh bg-[#f3ebe0] text-[#1a1714]">
      <ProofArticle
        snapshot={page.snapshot}
        slug={slug}
        siteHandle={site?.handle}
        otherSpans={others.map((item) =>
          spanFromSnapshot(item.slug, item.snapshot),
        )}
      />
    </main>
  );
}
