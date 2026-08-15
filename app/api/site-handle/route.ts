import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import {
  defaultHandle,
  isHandle,
  readSiteForAccount,
  writeSite,
} from "@/lib/paper/share";
import { readAccountState } from "@/lib/state/account-state";

export async function GET() {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  try {
    const site = await readSiteForAccount(account.id);
    if (site) return NextResponse.json({ ok: true, handle: site.handle });

    const state = await readAccountState(account.id);
    const handle = defaultHandle(
      state?.profile.identity.name || account.username,
      account.id,
    );
    return NextResponse.json({ ok: true, handle, suggested: true });
  } catch (error) {
    console.error("site-handle: read failed", error);
    return failure("store-down", 502);
  }
}

export async function PUT(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const body = await readBody(request);
  const handle = typeof body?.handle === "string" ? body.handle.trim().toLowerCase() : "";
  if (!isHandle(handle)) return failure("bad-handle", 400);

  try {
    await writeSite(account.id, handle);
    return NextResponse.json({ ok: true, handle });
  } catch (error) {
    const duplicate =
      error instanceof Error && /unique|duplicate/i.test(error.message);
    if (duplicate) return failure("handle-taken", 409);
    console.error("site-handle: write failed", error);
    return failure("store-down", 502);
  }
}
