import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import type { PaperBlockKey, PaperContent, PublishedProofLine } from "@/features/paper/model";
import { letterGhostsFor } from "@/features/paper/model";
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

const emptyExperience = {
  id: "e-empty",
  org: "",
  role: "",
  dates: "",
  bullets: [""],
};
const emptyEducation = { id: "ed-empty", school: "", line: "" };

const a4Class = "a4 mx-auto w-full max-w-[210mm] min-h-[297mm]";

export function DashedA4({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open a CV"
      data-paper-page="dashed"
      onClick={onOpen}
      className={cn(
        a4Class,
        "a4-dashed cursor-pointer focus-visible:shadow-[var(--focus-ring)]",
      )}
    />
  );
}

function ProofLines({ lines }: { lines: PublishedProofLine[] }) {
  if (!lines.length) return null;
  return (
    <section className="mt-8">
      {lines.map((line) => (
        <div key={`${line.date}:${line.words}`} className="mt-3 first:mt-0">
          {line.date ? (
            <p className="text-[13px] tabular-nums text-ink-muted">{line.date}</p>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap">{line.words}</p>
        </div>
      ))}
    </section>
  );
}

export function PaperCanvasPage({
  content,
  lines,
  onOpen,
}: {
  content: PaperContent;
  lines: PublishedProofLine[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Open this CV"
      data-paper-page="cv"
      onClick={onOpen}
      className={cn(
        a4Class,
        "cursor-pointer px-12 py-12 text-left text-[16px] leading-[1.6] focus-visible:shadow-[var(--focus-ring)]",
      )}
    >
      {content.name ? (
        <p className="text-[22px] font-medium leading-[1.3]">{content.name}</p>
      ) : null}
      {content.contact ? <p className="mt-1 text-[14px]">{content.contact}</p> : null}
      <ProofLines lines={lines} />
    </button>
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
  const focusRef = useRef<string | null>(null);
  const latest = useRef(content);
  latest.current = content;
  const tight = content.density === "tight";
  const pageClass = cn(
    a4Class,
    tight ? "px-8 py-8 text-[14px] leading-[1.4]" : "px-12 py-12 text-[16px] leading-[1.6]",
  );

  useEffect(() => {
    const id = focusRef.current;
    if (!id) return;
    const el = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
    el?.focus();
    focusRef.current = null;
  });

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

  const experience = content.experience.length ? content.experience : [emptyExperience];
  const education = content.education.length ? content.education : [emptyEducation];
  const skills = content.skills.length ? content.skills : [""];

  function enterOrBackspace(
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    opts: {
      empty: boolean;
      add: () => void;
      remove?: () => void;
    },
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      opts.add();
      return;
    }
    if (e.key === "Backspace" && opts.empty && opts.remove) {
      e.preventDefault();
      opts.remove();
    }
  }

  return (
    <article className={pageClass}>
      <SelectionMenu />
      <GhostInput
        className="text-[22px] font-medium leading-[1.3]"
        value={content.name}
        placeholder="Your name"
        aria-label="Name"
        onChange={(e) => {
          const page = { ...latest.current, name: e.target.value };
          latest.current = page;
          onChange(page);
        }}
        onBlur={() => onCommit("name", latest.current.name)}
      />
      <GhostInput
        className="mt-1 text-[14px]"
        value={content.contact}
        placeholder="Email · phone · city"
        aria-label="Contact"
        onChange={(e) => {
          const page = { ...latest.current, contact: e.target.value };
          latest.current = page;
          onChange(page);
        }}
        onBlur={() => onCommit("contact", latest.current.contact)}
      />

      {!content.hidden.experience ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide">Experience</h2>
          {experience.map((item, i) => (
            <div key={item.id} className="mt-3">
              <GhostInput
                value={item.role}
                placeholder="Role"
                aria-label="Role"
                onChange={(e) => {
                  const rows = latest.current.experience.length
                    ? latest.current.experience
                    : [emptyExperience];
                  setBlock(
                    "experience",
                    rows.map((row, idx) => (idx === i ? { ...row, role: e.target.value } : row)),
                  );
                }}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.org}
                placeholder="Organisation"
                aria-label="Organisation"
                onChange={(e) => {
                  const rows = latest.current.experience.length
                    ? latest.current.experience
                    : [emptyExperience];
                  setBlock(
                    "experience",
                    rows.map((row, idx) => (idx === i ? { ...row, org: e.target.value } : row)),
                  );
                }}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.dates}
                placeholder="Dates"
                aria-label="Dates"
                onChange={(e) => {
                  const rows = latest.current.experience.length
                    ? latest.current.experience
                    : [emptyExperience];
                  setBlock(
                    "experience",
                    rows.map((row, idx) => (idx === i ? { ...row, dates: e.target.value } : row)),
                  );
                }}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              {(item.bullets.length ? item.bullets : [""]).map((bullet, bi) => {
                const bullets = item.bullets.length ? item.bullets : [""];
                const focusId = `${item.id}-b${bi}`;
                return (
                  <div key={bi} className="mt-1">
                    <GhostLine
                      data-focus-id={focusId}
                      className="text-[14px]"
                      value={bullet}
                      placeholder="A result, with a number if you have one"
                      aria-label="Result"
                      onChange={(e) => {
                        const rows = latest.current.experience.length
                          ? latest.current.experience
                          : [emptyExperience];
                        const next = rows.map((row, idx) =>
                          idx === i
                            ? {
                                ...row,
                                bullets: (row.bullets.length ? row.bullets : [""]).map((b, bidx) =>
                                  bidx === bi ? e.target.value : b,
                                ),
                              }
                            : row,
                        );
                        setBlock("experience", next);
                      }}
                      onBlur={() => onCommit("experience", latest.current.experience)}
                      onKeyDown={(e) =>
                        enterOrBackspace(e, {
                          empty: !bullet,
                          add: () => {
                            const nextBullets = [
                              ...bullets.slice(0, bi + 1),
                              "",
                              ...bullets.slice(bi + 1),
                            ];
                            const next = experience.map((row, idx) =>
                              idx === i ? { ...row, bullets: nextBullets } : row,
                            );
                            focusRef.current = `${item.id}-b${bi + 1}`;
                            setBlock("experience", next, true);
                          },
                          remove:
                            bullets.length > 1
                              ? () => {
                                  const nextBullets = bullets.filter((_, idx) => idx !== bi);
                                  const next = experience.map((row, idx) =>
                                    idx === i ? { ...row, bullets: nextBullets } : row,
                                  );
                                  const prev = Math.max(0, bi - 1);
                                  focusRef.current = `${item.id}-b${prev}`;
                                  setBlock("experience", next, true);
                                }
                              : undefined,
                        })
                      }
                    />
                    {bullets.length > 1 ? (
                      <PageAction
                        onClick={() => {
                          const nextBullets = bullets.filter((_, idx) => idx !== bi);
                          const next = experience.map((row, idx) =>
                            idx === i ? { ...row, bullets: nextBullets.length ? nextBullets : [""] } : row,
                          );
                          setBlock("experience", next, true);
                        }}
                      >
                        Remove this result
                      </PageAction>
                    ) : null}
                  </div>
                );
              })}
              <PageAction
                onClick={() => {
                  const next = experience.map((row, idx) =>
                    idx === i
                      ? { ...row, bullets: [...(row.bullets.length ? row.bullets : [""]), ""] }
                      : row,
                  );
                  const nextBullets = next[i]?.bullets ?? [""];
                  focusRef.current = `${item.id}-b${nextBullets.length - 1}`;
                  setBlock("experience", next, true);
                }}
              >
                Add a result
              </PageAction>
              {experience.length > 1 || item.role || item.org || item.dates || item.bullets.some(Boolean) ? (
                <PageAction
                  onClick={() => {
                    const next =
                      experience.length > 1
                        ? experience.filter((_, idx) => idx !== i)
                        : [{ ...emptyExperience, id: newId() }];
                    setBlock("experience", next, true);
                  }}
                >
                  Remove this role
                </PageAction>
              ) : null}
            </div>
          ))}
          <PageAction
            onClick={() => {
              const next = [
                ...experience,
                { id: newId(), org: "", role: "", dates: "", bullets: [""] },
              ];
              setBlock("experience", next, true);
            }}
          >
            Add a role
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.education ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide">Education</h2>
          {education.map((item, i) => (
            <div key={item.id} className="mt-3">
              <GhostInput
                value={item.school}
                placeholder="School"
                aria-label="School"
                onChange={(e) => {
                  const rows = latest.current.education.length
                    ? latest.current.education
                    : [emptyEducation];
                  setBlock(
                    "education",
                    rows.map((row, idx) => (idx === i ? { ...row, school: e.target.value } : row)),
                  );
                }}
                onBlur={() => onCommit("education", latest.current.education)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.line}
                placeholder="Major, year"
                aria-label="Education"
                onChange={(e) => {
                  const rows = latest.current.education.length
                    ? latest.current.education
                    : [emptyEducation];
                  setBlock(
                    "education",
                    rows.map((row, idx) => (idx === i ? { ...row, line: e.target.value } : row)),
                  );
                }}
                onBlur={() => onCommit("education", latest.current.education)}
              />
              {education.length > 1 || item.school || item.line ? (
                <PageAction
                  onClick={() => {
                    const next =
                      education.length > 1
                        ? education.filter((_, idx) => idx !== i)
                        : [{ ...emptyEducation, id: newId() }];
                    setBlock("education", next, true);
                  }}
                >
                  Remove this school
                </PageAction>
              ) : null}
            </div>
          ))}
          <PageAction
            onClick={() =>
              setBlock("education", [...education, { id: newId(), school: "", line: "" }], true)
            }
          >
            Add a school
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.skills ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide">Skills</h2>
          {skills.map((skill, i) => {
            const focusId = `skill-${i}`;
            return (
              <div key={i} className="mt-1">
                <GhostInput
                  data-focus-id={focusId}
                  className="text-[14px]"
                  value={skill}
                  placeholder="A skill you can show"
                  aria-label="Skill"
                  onChange={(e) => {
                    const rows = latest.current.skills.length ? latest.current.skills : [""];
                    setBlock(
                      "skills",
                      rows.map((s, idx) => (idx === i ? e.target.value : s)),
                    );
                  }}
                  onBlur={() => onCommit("skills", latest.current.skills)}
                  onKeyDown={(e) =>
                    enterOrBackspace(e, {
                      empty: !skill,
                      add: () => {
                        const next = [...skills.slice(0, i + 1), "", ...skills.slice(i + 1)];
                        focusRef.current = `skill-${i + 1}`;
                        setBlock("skills", next, true);
                      },
                      remove:
                        skills.length > 1
                          ? () => {
                              const next = skills.filter((_, idx) => idx !== i);
                              focusRef.current = `skill-${Math.max(0, i - 1)}`;
                              setBlock("skills", next, true);
                            }
                          : undefined,
                    })
                  }
                />
                {skills.length > 1 ? (
                  <PageAction
                    onClick={() => {
                      const next = skills.filter((_, idx) => idx !== i);
                      setBlock("skills", next.length ? next : [""], true);
                    }}
                  >
                    Remove this skill
                  </PageAction>
                ) : null}
              </div>
            );
          })}
          <PageAction
            onClick={() => {
              const next = [...skills, ""];
              focusRef.current = `skill-${next.length - 1}`;
              setBlock("skills", next, true);
            }}
          >
            Add a skill
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.proof && publishedLines.length ? (
        <ProofLines lines={publishedLines} />
      ) : null}
    </article>
  );
}
