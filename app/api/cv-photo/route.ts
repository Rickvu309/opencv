import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure } from "@/lib/auth/http";
import {
  MAX_PHOTO_BYTES,
  deletePhoto,
  isPhotoMime,
  readPhoto,
  writePhoto,
} from "@/lib/cv/photos";

/**
 * A CV's photo: fetch it, replace it, remove it.
 *
 * The account comes from the session and the CV id from the query, so the pair
 * that identifies a row is half chosen by the caller and half not. That is what
 * makes it safe: asking for somebody else's CV id returns this account's row
 * for that id, which does not exist, rather than theirs.
 *
 * The body is the image itself rather than JSON with a data URI. Base64 costs a
 * third more bytes to say the same thing, and this is the one request in the
 * product where the payload is measured in tens of kilobytes.
 */

function resumeIdOf(request: Request): string | null {
  const id = new URL(request.url).searchParams.get("resumeId");
  return id && id.trim().length > 0 ? id : null;
}

export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const resumeId = resumeIdOf(request);
  if (!resumeId) return failure("bad-request", 400);

  try {
    const photo = await readPhoto(account.id, resumeId);
    if (!photo) return failure("not-found", 404);

    return new NextResponse(new Uint8Array(photo.image), {
      headers: {
        "content-type": photo.mime,
        // Private, because this is somebody's face and a shared cache in front
        // of the app must not hold it. Revalidated on every request; the URL
        // carries the stamp, so a replaced photo is a different URL anyway.
        "cache-control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("cv-photo: read failed", error);
    return failure("store-down", 502);
  }
}

export async function PUT(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const resumeId = resumeIdOf(request);
  if (!resumeId) return failure("bad-request", 400);

  const mime = request.headers.get("content-type")?.split(";")[0]?.trim();
  // SVG is deliberately not on the list: it is a document that can carry
  // script, and this renders inside the app's own origin.
  if (!isPhotoMime(mime)) return failure("bad-image", 415);

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) return failure("bad-request", 400);
  // The client downscales before sending. This is the brake for when it did
  // not, which includes anything that is not the client.
  if (body.byteLength > MAX_PHOTO_BYTES) return failure("too-large", 413);

  try {
    await writePhoto(account.id, resumeId, Buffer.from(body), mime);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("cv-photo: write failed", error);
    return failure("store-down", 502);
  }
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const resumeId = resumeIdOf(request);
  if (!resumeId) return failure("bad-request", 400);

  try {
    await deletePhoto(account.id, resumeId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("cv-photo: delete failed", error);
    return failure("store-down", 502);
  }
}
