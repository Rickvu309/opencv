import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";

import {
  listProofPages,
  readProofPage,
  readSite,
  readSiteForAccount,
} from "./share-store.server";
import { spanFromSnapshot } from "./spans";

export const loadPublicProof = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const page = await readProofPage(slug);
    if (!page) return null;
    const site = await readSiteForAccount(page.accountId);
    const others = site
      ? (await listProofPages(page.accountId)).filter(
          (item) => item.slug !== slug,
        )
      : [];
    return {
      slug,
      snapshot: page.snapshot,
      siteHandle: site?.handle,
      otherSpans: others.map((item) =>
        spanFromSnapshot(item.slug, item.snapshot),
      ),
    };
  });

export const loadPersonalSite = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data: handle }) => {
    const site = await readSite(handle);
    if (!site) throw notFound();
    const pages = await listProofPages(site.accountId);
    return {
      handle,
      name: pages.find((page) => page.snapshot.name)?.snapshot.name,
      spans: pages.map((page) => spanFromSnapshot(page.slug, page.snapshot)),
    };
  });
