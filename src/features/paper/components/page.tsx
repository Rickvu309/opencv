import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import type { PaperBlockKey, PaperContent, PublishedProofLine } from "@/features/paper/model";
import {
  isTypedEducation,
  isTypedExperience,
  isTypedSkill,
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
function blankSchool() {
  return { id: newId(), school: "", line: "" };
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
  const focusRef = useRef<string | null>(null);
  const latest = useRef(content);
  latest.current = content;
  const [drafts, setDrafts] = useState({
    experience: [] as PaperContent["experience"],
    education: [] as PaperContent["education"],
    skills: [] as string[],
  });
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

  const view = openedCvPage(content);
  const experience = [...view.experience, ...drafts.experience];
  const education = [...view.education, ...drafts.education];
  const skills = [...view.skills.map((skill) => ({ skill, typed: true as const })), ...drafts.skills.map((skill) => ({ skill, typed: false as const }))];

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

  function writeEducation(nextRow: PaperContent["education"][number], commit = false) {
    if (isTypedEducation(nextRow) || latest.current.education.some((row) => row.id === nextRow.id)) {
      const inContent = latest.current.education.some((row) => row.id === nextRow.id);
      const next = inContent
        ? latest.current.education.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [...latest.current.education, nextRow];
      setDrafts((d) => ({ ...d, education: d.education.filter((row) => row.id !== nextRow.id) }));
      setBlock("education", next, commit);
      return;
    }
    setDrafts((d) => ({
      ...d,
      education: d.education.map((row) => (row.id === nextRow.id ? nextRow : row)),
    }));
  }

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
        <section className={view.showExperienceHeading || experience.length ? "mt-8" : undefined}>
          {view.showExperienceHeading ? (
            <h2 className="text-[13px] font-medium uppercase tracking-wide">Experience</h2>
          ) : null}
          {experience.map((item) => {
            const typed = isTypedExperience(item);
            return (
            <div key={item.id} className="mt-3">
              <GhostInput
                value={item.role}
                aria-label="Role"
                onChange={(e) => writeExperience({ ...item, role: e.target.value })}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.org}
                aria-label="Organisation"
                onChange={(e) => writeExperience({ ...item, org: e.target.value })}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.dates}
                aria-label="Dates"
                onChange={(e) => writeExperience({ ...item, dates: e.target.value })}
                onBlur={() => onCommit("experience", latest.current.experience)}
              />
              {typed
                ? item.bullets.map((bullet, bi) => {
                const focusId = `${item.id}-b${bi}`;
                return (
                  <div key={bi} className="mt-1">
                    <GhostLine
                      data-focus-id={focusId}
                      className="text-[14px]"
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
                      onKeyDown={(e) =>
                        enterOrBackspace(e, {
                          empty: !bullet,
                          add: () => {
                            const nextBullets = [
                              ...item.bullets.slice(0, bi + 1),
                              "",
                              ...item.bullets.slice(bi + 1),
                            ];
                            focusRef.current = `${item.id}-b${bi + 1}`;
                            writeExperience({ ...item, bullets: nextBullets }, true);
                          },
                          remove:
                            item.bullets.length > 1
                              ? () => {
                                  const nextBullets = item.bullets.filter((_, idx) => idx !== bi);
                                  const prev = Math.max(0, bi - 1);
                                  focusRef.current = `${item.id}-b${prev}`;
                                  writeExperience({ ...item, bullets: nextBullets }, true);
                                }
                              : undefined,
                        })
                      }
                    />
                    {item.bullets.length > 1 ? (
                      <PageAction
                        onClick={() => {
                          writeExperience(
                            { ...item, bullets: item.bullets.filter((_, idx) => idx !== bi) },
                            true,
                          );
                        }}
                      >
                        Remove this result
                      </PageAction>
                    ) : null}
                  </div>
                );
              })
                : null}
              {typed ? (
                <PageAction
                  onClick={() => {
                    const nextBullets = [...item.bullets, ""];
                    focusRef.current = `${item.id}-b${nextBullets.length - 1}`;
                    writeExperience({ ...item, bullets: nextBullets }, true);
                  }}
                >
                  Add a result
                </PageAction>
              ) : null}
              {typed ? (
                <PageAction
                  onClick={() => {
                    setBlock(
                      "experience",
                      latest.current.experience.filter((row) => row.id !== item.id),
                      true,
                    );
                  }}
                >
                  Remove this role
                </PageAction>
              ) : null}
            </div>
            );
          })}
          <PageAction
            onClick={() => {
              setDrafts((d) => ({ ...d, experience: [...d.experience, blankRole()] }));
            }}
          >
            Add a role
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.education ? (
        <section className={view.showEducationHeading || education.length ? "mt-8" : undefined}>
          {view.showEducationHeading ? (
            <h2 className="text-[13px] font-medium uppercase tracking-wide">Education</h2>
          ) : null}
          {education.map((item) => {
            const typed = isTypedEducation(item);
            return (
            <div key={item.id} className="mt-3">
              <GhostInput
                value={item.school}
                aria-label="School"
                onChange={(e) => writeEducation({ ...item, school: e.target.value })}
                onBlur={() => onCommit("education", latest.current.education)}
              />
              <GhostInput
                className="text-[14px]"
                value={item.line}
                aria-label="Education"
                onChange={(e) => writeEducation({ ...item, line: e.target.value })}
                onBlur={() => onCommit("education", latest.current.education)}
              />
              {typed ? (
                <PageAction
                  onClick={() => {
                    setBlock(
                      "education",
                      latest.current.education.filter((row) => row.id !== item.id),
                      true,
                    );
                  }}
                >
                  Remove this school
                </PageAction>
              ) : null}
            </div>
            );
          })}
          <PageAction
            onClick={() => {
              setDrafts((d) => ({ ...d, education: [...d.education, blankSchool()] }));
            }}
          >
            Add a school
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.skills ? (
        <section className={view.showSkillsHeading || skills.length ? "mt-8" : undefined}>
          {view.showSkillsHeading ? (
            <h2 className="text-[13px] font-medium uppercase tracking-wide">Skills</h2>
          ) : null}
          {skills.map((row, i) => {
            const focusId = `skill-${i}`;
            return (
              <div key={i} className="mt-1">
                <GhostInput
                  data-focus-id={focusId}
                  className="text-[14px]"
                  value={row.skill}
                  aria-label="Skill"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (row.typed) {
                      const typed = latest.current.skills.filter(isTypedSkill);
                      const idx = typed.findIndex((s) => s === row.skill);
                      setBlock(
                        "skills",
                        typed.map((s, sidx) => (sidx === idx ? value : s)),
                      );
                      return;
                    }
                    const draftIdx = i - view.skills.length;
                    if (isTypedSkill(value)) {
                      setBlock("skills", [...latest.current.skills.filter(isTypedSkill), value]);
                      setDrafts((d) => ({
                        ...d,
                        skills: d.skills.filter((_, idx) => idx !== draftIdx),
                      }));
                      return;
                    }
                    setDrafts((d) => ({
                      ...d,
                      skills: d.skills.map((s, idx) => (idx === draftIdx ? value : s)),
                    }));
                  }}
                  onBlur={() => onCommit("skills", latest.current.skills)}
                  onKeyDown={(e) =>
                    enterOrBackspace(e, {
                      empty: !row.skill,
                      add: row.typed
                        ? () => {
                            setDrafts((d) => ({ ...d, skills: [...d.skills, ""] }));
                          }
                        : () => undefined,
                      remove: row.typed
                        ? () => {
                            setBlock(
                              "skills",
                              latest.current.skills.filter((s) => s !== row.skill),
                              true,
                            );
                          }
                        : undefined,
                    })
                  }
                />
                {row.typed ? (
                  <PageAction
                    onClick={() => {
                      setBlock(
                        "skills",
                        latest.current.skills.filter((s) => s !== row.skill),
                        true,
                      );
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
              setDrafts((d) => ({ ...d, skills: [...d.skills, ""] }));
            }}
          >
            Add a skill
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.proof && publishedLines.length ? (
        <ProofLines lines={publishedLines} className="mt-8" />
      ) : null}
    </article>
  );
}
