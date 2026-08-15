import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure } from "@/lib/auth/http";
import {
  MAX_FILE_BYTES,
  deleteFile,
  isFileMime,
  mimeFromName,
  readFile,
  writeFile,
} from "@/lib/paper/files";

function uploadIdOf(request: Request): string | null {
  const id = new URL(request.url).searchParams.get("uploadId");
  return id && id.trim().length > 0 ? id : null;
}

export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const uploadId = uploadIdOf(request);
  if (!uploadId) return failure("bad-request", 400);

  try {
    const file = await readFile(account.id, uploadId);
    if (!file) return failure("not-found", 404);

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.mime,
        "content-disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
        "cache-control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("paper-file: read failed", error);
    return failure("store-down", 502);
  }
}

export async function PUT(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const uploadId = uploadIdOf(request);
  if (!uploadId) return failure("bad-request", 400);

  const fileName = request.headers.get("x-file-name")?.trim() || "upload.pdf";
  const mime =
    request.headers.get("content-type")?.split(";")[0]?.trim() ||
    mimeFromName(fileName);
  if (!isFileMime(mime)) return failure("bad-file", 415);

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) return failure("bad-request", 400);
  if (body.byteLength > MAX_FILE_BYTES) return failure("too-large", 413);

  try {
    await writeFile(account.id, uploadId, Buffer.from(body), mime, fileName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("paper-file: write failed", error);
    return failure("store-down", 502);
  }
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const uploadId = uploadIdOf(request);
  if (!uploadId) return failure("bad-request", 400);

  try {
    await deleteFile(account.id, uploadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("paper-file: delete failed", error);
    return failure("store-down", 502);
  }
}
