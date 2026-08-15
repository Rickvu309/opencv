import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { isProofPaper } from "@/lib/paper/types";
import {
  defaultHandle,
  isHandle,
  readSiteForAccount,
  snapshotOf,
  slugifyHandle,
  writeProofPage,
  writeSite,
} from "@/lib/paper/share";
import { readAccountState } from "@/lib/state/account-state";

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const body = await readBody(request);
  const paperId = typeof body?.paperId === "string" ? body.paperId.trim() : "";
  if (!paperId) return failure("bad-request", 400);

  try {
    const state = await readAccountState(account.id);
    const paper = state?.paper.find((item) => item.id === paperId);
    if (!state || !paper || !isProofPaper(paper)) return failure("not-found", 404);

    let site = await readSiteForAccount(account.id);
    if (!site) {
      const handle = defaultHandle(
        state.profile.identity.name || account.username,
        account.id,
      );
      await writeSite(account.id, handle);
      site = { accountId: account.id, handle };
    }

    const slug = `${slugifyHandle(paper.label || "proof")}-${account.id.replace(/-/g, "").slice(0, 8)}`;
    if (!isHandle(site.handle)) return failure("bad-request", 400);

    await writeProofPage({
      slug,
      accountId: account.id,
      paperId: paper.id,
      snapshot: snapshotOf(paper),
    });

    return NextResponse.json({ ok: true, slug, handle: site.handle });
  } catch (error) {
    console.error("proof-share: write failed", error);
    return failure("store-down", 502);
  }
}
