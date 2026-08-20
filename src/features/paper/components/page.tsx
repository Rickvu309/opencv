import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import type { PaperBlockKey, PaperContent, PublishedProofLine } from "@/features/paper/model";
import {
  isTypedExperience,
  keepPublishedProofWords,
  letterGhostsFor,
  openedCvPage,
} from "@/features/paper/model";
import { SelectionMenu } from "@/features/paper/components/selection";
import { cn } from "@/lib/utils";

function newId() {
  return crypto.randomUUID();
}

function GhostInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-transparent outline-none placeholder:text-ink-faint",
        props.className,
      )}
    />
  );
}

function GhostTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "mt-4 min-h-24 w-full resize-none bg-transparent outline-none placeholder:text-ink-faint",
        props.className,
      )}
    />
  );
}

function GhostLine({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-ink-faint",
        className,
      )}
    />
  );
}

function PageAction({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-print-hide
      onClick={onClick}
      className="mt-2 inline-flex min-h-11 items-center text-[13px] text-ink-muted hover:text-ink print:hidden"
    >
      {children}
    </button>
  );
}

function blankRole() {
  return { id: newId(), org: "", role: "", dates: "", bullets: [] as string[] };
}

const a4Class = "a4 mx-auto w-full max-w-[210mm] min-h-[297mm]";

function formatProofDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!iso) return value;
  const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function ProofLines({
  lines,
  className,
}: {
  lines: PublishedProofLine[];
  className?: string;
}) {
  if (!lines.length) return null;
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <div key={`${line.date}:${line.words}`} className={i === 0 ? undefined : "mt-8"}>
          {line.date ? (
            <p className="text-[13px] text-ink-muted tabular-nums">{formatProofDate(line.date)}</p>
          ) : null}
          <p className="mt-3 whitespace-pre-wrap text-[15px] font-[510] leading-[1.6]">{line.words}</p>
        </div>
      ))}
    </div>
  );
}

export function PaperPage({
  kind,
  content,
  publishedLines = [],
  onChange,
  onCommit,
}: {
  kind: string;
  content: PaperContent;
  publishedLines?: PublishedProofLine[];
  onChange: (next: PaperContent) => void;
  onCommit: (key: PaperBlockKey, value: PaperContent[PaperBlockKey]) => void;
}) {
  const latest = useRef(content);
  latest.current = content;
  const [drafts, setDrafts] = useState({
    experience: [] as PaperContent["experience"],
  });
  const tight = content.density === "tight";
  const pageClass = cn(
    a4Class,
    tight ? "px-8 py-8 text-[14px] leading-[1.4]" : "px-12 py-12 text-[16px] leading-[1.6]",
  );

  function setBlock<K extends PaperBlockKey>(key: K, value: PaperContent[K], commit = false) {
    const page = { ...latest.current, [key]: value };
    latest.current = page;
    onChange(page);
    if (commit) onCommit(key, value);
  }

  if (kind === "letter") {
    const ghosts = letterGhostsFor(content.situation);
    const paragraphs = content.paragraphs.length ? content.paragraphs : ["", "", ""];
    return (
      <article className={pageClass}>
        {paragraphs.map((paragraph, i) => (
          <GhostTextarea
            key={i}
            value={paragraph}
            placeholder={ghosts[i] ?? "Write this paragraph"}
            aria-label={`Paragraph ${i + 1}`}
            onChange={(e) => {
              const next = paragraphs.map((p, idx) => (idx === i ? e.target.value : p));
              const page = { ...latest.current, paragraphs: next };
              latest.current = page;
              onChange(page);
            }}
            onBlur={() => onCommit("paragraphs", latest.current.paragraphs)}
          />
        ))}
      </article>
    );
  }

  const view = openedCvPage(content, publishedLines);
  const experience = [...view.experience, ...drafts.experience];

  function writeExperience(nextRow: PaperContent["experience"][number], commit = false) {
    if (isTypedExperience(nextRow) || latest.current.experience.some((row) => row.id === nextRow.id)) {
      const inContent = latest.current.experience.some((row) => row.id === nextRow.id);
      const next = inContent
        ? latest.current.experience.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [...latest.current.experience, nextRow];
      setDrafts((d) => ({ ...d, experience: d.experience.filter((row) => row.id !== nextRow.id) }));
      setBlock("experience", next, commit);
      return;
    }
    setDrafts((d) => ({
      ...d,
      experience: d.experience.map((row) => (row.id === nextRow.id ? nextRow : row)),
    }));
  }

  const pageProof =
    !view.proofUnderRoleId && view.proofLines.length ? (
      <ProofLines
        lines={view.proofLines}
        className={experience.length ? "mt-8" : undefined}
      />
    ) : null;

  return (
    <article className={pageClass}>
      <SelectionMenu />
      {view.name ? (
        <GhostInput
          className="text-[22px] font-medium leading-[1.3]"
          value={content.name}
          aria-label="Name"
          onChange={(e) => {
            const next = { ...latest.current, name: e.target.value };
            latest.current = next;
            onChange(next);
          }}
          onBlur={() => onCommit("name", latest.current.name)}
        />
      ) : null}
      {view.contact ? (
        <GhostInput
          className="mt-1 text-[14px]"
          value={content.contact}
          aria-label="Contact"
          onChange={(e) => {
            const next = { ...latest.current, contact: e.target.value };
            latest.current = next;
            onChange(next);
          }}
          onBlur={() => onCommit("contact", latest.current.contact)}
        />
      ) : null}

      {!content.hidden.experience ? (
        <section
          className={
            (view.name || view.contact) && (experience.length || view.proofLines.length)
              ? "mt-8"
              : undefined
          }
        >
          {experience.map((item) => {
            const ownBullets = item.bullets
              .map((bullet, bi) => ({ bullet, bi }))
              .filter(
                ({ bullet }) =>
                  Boolean(bullet.trim()) && !keepPublishedProofWords(bullet, view.proofLines),
              );
            return (
              <div key={item.id} className="mt-3">
                <GhostInput
                  value={item.role}
                  aria-label="Job name"
                  onChange={(e) => writeExperience({ ...item, role: e.target.value })}
                  onBlur={() => onCommit("experience", latest.current.experience)}
                />
                {item.org.trim() ? (
                  <GhostInput
                    className="text-[14px]"
                    value={item.org}
                    aria-label={item.org}
                    onChange={(e) => writeExperience({ ...item, org: e.target.value })}
                    onBlur={() => onCommit("experience", latest.current.experience)}
                  />
                ) : null}
                {item.dates.trim() ? (
                  <GhostInput
                    className="text-[14px]"
                    value={item.dates}
                    aria-label={item.dates}
                    onChange={(e) => writeExperience({ ...item, dates: e.target.value })}
                    onBlur={() => onCommit("experience", latest.current.experience)}
                  />
                ) : null}
                {ownBullets.map(({ bullet, bi }) => (
                  <GhostLine
                    key={bi}
                    className="mt-1 text-[14px]"
                    value={bullet}
                    aria-label="Result"
                    onChange={(e) =>
                      writeExperience({
                        ...item,
                        bullets: item.bullets.map((b, bidx) =>
                          bidx === bi ? e.target.value : b,
                        ),
                      })
                    }
                    onBlur={() => onCommit("experience", latest.current.experience)}
                  />
                ))}
                {view.proofUnderRoleId === item.id ? (
                  <ProofLines lines={view.proofLines} className="mt-3" />
                ) : null}
              </div>
            );
          })}
          {pageProof}
          <PageAction
            onClick={() => {
              setDrafts((d) => ({ ...d, experience: [...d.experience, blankRole()] }));
            }}
          >
            Add a role
          </PageAction>
        </section>
      ) : pageProof}
    </article>
  );
}
