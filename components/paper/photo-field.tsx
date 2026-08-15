"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDispatch } from "@/lib/actions/store";
import { photoUrl } from "@/lib/paper/photo-url";
import type { CvPaper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";

/**
 * Add or replace the photo on a CV.
 *
 * ## Why the image is resized here rather than on the server
 *
 * A photo off a phone is three or four megabytes of a face that will be printed
 * at 3cm across. Sending that to a database in another region, so the server
 * can throw 95% of it away, is a slow upload on a connection that may be a
 * phone's, to accomplish nothing. The canvas does it in the tab, before
 * anything leaves.
 *
 * The server still enforces a limit, because a client-side rule is a courtesy
 * and not a constraint.
 */

/** Long edge, in pixels. A 3cm print at 300dpi is about 350px; 512 has room. */
const MAX_EDGE = 512;
const QUALITY = 0.85;

export function PhotoField({ cv }: { cv: CvPaper }) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const shrunk = await downscale(file);
      const response = await fetch(
        `/api/paper-photo?paperId=${encodeURIComponent(cv.id)}`,
        { method: "PUT", headers: { "content-type": "image/jpeg" }, body: shrunk },
      );
      if (!response.ok) throw new Error(String(response.status));
      // The stamp is what makes the URL change, so the browser fetches the new
      // photo instead of showing the one it already has.
      dispatch("paper.setPhoto", { id: cv.id, stamp: String(Date.now()) });
    } catch {
      toast.error(t(m.paper.cv.photoFailed));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/paper-photo?paperId=${encodeURIComponent(cv.id)}`, {
        method: "DELETE",
      });
    } catch {
      // The row may still be there. Clearing the stamp anyway is right: the
      // user asked for it gone, and a photo with no stamp is never rendered.
    } finally {
      dispatch("paper.setPhoto", { id: cv.id });
      setBusy(false);
    }
  }

  const url = photoUrl(cv);

  return (
    <div className="flex items-center gap-3">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           a same-origin route that streams bytes from Postgres behind a
           session, not a static asset next/image could optimise. */
        <img
          src={url}
          alt={t(m.paper.cv.photoAlt)}
          className="size-16 rounded-md border object-cover"
        />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImagePlus className="size-5" />
        </div>
      )}

      <div className="min-w-0">
        <p className="text-sm font-medium">{t(m.paper.cv.photo)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t(m.paper.cv.photoHint)}</p>
        <div className="mt-2 flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy && <Spinner />}
            {t(url ? m.paper.cv.photoReplace : m.paper.cv.photoAdd)}
          </Button>
          {url && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t(m.paper.cv.photoRemove)}
              disabled={busy}
              onClick={remove}
              className="text-muted-foreground"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

/**
 * The image, scaled to fit `MAX_EDGE` and re-encoded as JPEG.
 *
 * Square-cropped from the centre, because every template renders the photo in a
 * square and letting the browser letterbox it would put grey bars on somebody's
 * CV.
 */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const edge = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(edge, MAX_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");

    context.drawImage(
      bitmap,
      // The centre square of the original.
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      size,
      size,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
        "image/jpeg",
        QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
