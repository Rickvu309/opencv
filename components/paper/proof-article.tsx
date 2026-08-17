import { Link } from "@/lib/nav";

import type { ProofSnapshot, ProofSnapshotNote } from "@/lib/paper/share";
import { spanFromSnapshot, yearRange, type ProofSpan } from "@/lib/paper/spans";

export function ProofArticle({
  snapshot,
  slug,
  siteHandle,
  otherSpans = [],
}: {
  snapshot: ProofSnapshot;
  slug?: string;
  siteHandle?: string;
  otherSpans?: ProofSpan[];
}) {
  const self = slug ? spanFromSnapshot(slug, snapshot) : null;
  const range = self ? yearRange([self, ...otherSpans]) : null;
  const line = [snapshot.role, snapshot.dates, snapshot.link]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-[65ch] px-6 py-10 text-[#1a1714]">
      {snapshot.name && siteHandle ? (
        <p className="text-sm">
          <Link href={`/u/${siteHandle}`} className="underline underline-offset-4">
            {snapshot.name}
          </Link>
        </p>
      ) : siteHandle ? (
        <p className="text-sm">
          <Link href={`/u/${siteHandle}`} className="underline underline-offset-4">
            More from this person
          </Link>
        </p>
      ) : snapshot.name ? (
        <p className="text-sm">{snapshot.name}</p>
      ) : null}

      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-pretty">
        {snapshot.title || "Untitled Proof"}
      </h1>

      {line ? (
        <p className="mt-4">
          {siteHandle ? (
            <Link href={`/u/${siteHandle}`} className="block">
              <span className="text-sm text-[#6b645c]">{line}</span>
              {self && range && snapshot.dates ? (
                <span className="relative mt-2 block h-4" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#1a1714]/20" />
                  <HairlineMark span={self} range={range} ink />
                  {otherSpans.map((tick) => (
                    <HairlineMark key={tick.slug} span={tick} range={range} />
                  ))}
                </span>
              ) : null}
            </Link>
          ) : (
            <span className="text-sm text-[#6b645c]">{line}</span>
          )}
        </p>
      ) : null}

      {snapshot.why && (
        <p className="mt-8 max-w-[65ch] text-lg leading-relaxed text-pretty">
          {snapshot.why}
        </p>
      )}

      <div className="mt-12 space-y-10">
        {snapshot.notes.map((note, index) => (
          <ProofMaterial key={`${note.at}-${index}`} note={note} />
        ))}
      </div>
    </article>
  );
}

function ProofMaterial({ note }: { note: ProofSnapshotNote }) {
  if (note.kind === "photo" && note.url) {
    return (
      <figure>
        <img src={note.url} alt={note.text || note.fileName || ""} className="w-full" />
        {note.text ? (
          <figcaption className="mt-2 text-sm text-[#6b645c]">{note.text}</figcaption>
        ) : null}
      </figure>
    );
  }
  if (note.kind === "link" && note.url) {
    return (
      <p className="text-lg leading-relaxed">
        <a href={note.url} className="underline underline-offset-4">
          {note.text || note.url}
        </a>
      </p>
    );
  }
  if (note.kind === "file") {
    return (
      <p className="text-lg leading-relaxed">
        {note.url ? (
          <a href={note.url} className="underline underline-offset-4">
            {note.text || note.fileName || "File"}
          </a>
        ) : (
          <span>{note.text || note.fileName}</span>
        )}
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-lg leading-relaxed">{note.text}</p>
  );
}

function HairlineMark({
  span,
  range,
  ink,
}: {
  span: ProofSpan;
  range: { start: number; end: number };
  ink?: boolean;
}) {
  const width = Math.max(1, range.end - range.start);
  const left = ((span.start - range.start) / width) * 100;
  const spanWidth = span.tick
    ? 0
    : Math.max(((span.end - span.start) / width) * 100, 2);
  return (
    <span
      className="absolute top-1/2 -translate-y-1/2"
      style={{
        left: `${left}%`,
        width: span.tick ? undefined : `${spanWidth}%`,
      }}
    >
      {span.tick ? (
        <span
          className={
            ink
              ? "block size-1.5 -translate-x-1/2 rounded-full bg-[#1a1714]"
              : "block size-1 -translate-x-1/2 rounded-full bg-[#1a1714]/30"
          }
        />
      ) : (
        <span
          className={
            ink
              ? "block h-1 rounded-full bg-[#1a1714]"
              : "block h-px bg-[#1a1714]/30"
          }
        />
      )}
    </span>
  );
}
