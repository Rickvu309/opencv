import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { isProofPaper } from "@/lib/paper/types";
import {
  deleteProofPage,
  placementForPublish,
  readSiteForAccount,
  snapshotOf,
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

    const site = await readSiteForAccount(account.id);
    const placement = placementForPublish({
      label: paper.label,
      accountId: account.id,
      name: state.profile.identity.name || account.username,
      handle: site?.handle,
    });
    if (!placement) return failure("bad-request", 400);
    if (!site) await writeSite(account.id, placement.handle);

    await writeProofPage({
      slug: placement.slug,
      accountId: account.id,
      paperId: paper.id,
      snapshot: snapshotOf(paper, new Date(), {
        name: state.profile.identity.name || undefined,
      }),
    });

    return Response.json({
      ok: true,
      slug: placement.slug,
      handle: placement.handle,
    });
  } catch (error) {
    console.error("proof-share: write failed", error);
    return failure("store-down", 502);
  }
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const body = await readBody(request);
  const paperId = typeof body?.paperId === "string" ? body.paperId.trim() : "";
  if (!paperId) return failure("bad-request", 400);

  try {
    await deleteProofPage(paperId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("proof-share: delete failed", error);
    return failure("store-down", 502);
  }
}
