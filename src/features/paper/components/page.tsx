import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { PaperContent } from "@/features/paper/model";
import { letterGhostsFor } from "@/features/paper/model";
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
      onClick={onClick}
      className="mt-2 inline-flex min-h-11 items-center text-[13px] text-ink-muted hover:text-ink"
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

export function PaperPage({
  kind,
  content,
  onChange,
  onSave,
}: {
  kind: string;
  content: PaperContent;
  onChange: (next: PaperContent) => void;
  onSave: (next?: PaperContent) => void;
}) {
  const tight = content.density === "tight";
  const pageClass = cn(
    "a4 mx-auto w-full max-w-[210mm] min-h-[297mm]",
    tight ? "px-8 py-8 text-[14px] leading-[1.4]" : "px-12 py-12 text-[16px] leading-[1.6]",
  );

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
              onChange({ ...content, paragraphs: next });
            }}
            onBlur={() => onSave()}
          />
        ))}
      </article>
    );
  }

  const experience = content.experience.length ? content.experience : [emptyExperience];
  const education = content.education.length ? content.education : [emptyEducation];
  const skills = content.skills.length ? content.skills : [""];

  return (
    <article className={pageClass}>
      <GhostInput
        className="text-[22px] font-medium leading-[1.3]"
        value={content.name}
        placeholder="Your name"
        aria-label="Name"
        onChange={(e) => onChange({ ...content, name: e.target.value })}
        onBlur={() => onSave()}
      />
      <GhostInput
        className="mt-1 text-[14px]"
        value={content.contact}
        placeholder="Email · phone · city"
        aria-label="Contact"
        onChange={(e) => onChange({ ...content, contact: e.target.value })}
        onBlur={() => onSave()}
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
                  const next = experience.map((row, idx) =>
                    idx === i ? { ...row, role: e.target.value } : row,
                  );
                  onChange({ ...content, experience: next });
                }}
                onBlur={() => onSave()}
              />
              <GhostInput
                className="text-[14px]"
                value={item.org}
                placeholder="Organisation"
                aria-label="Organisation"
                onChange={(e) => {
                  const next = experience.map((row, idx) =>
                    idx === i ? { ...row, org: e.target.value } : row,
                  );
                  onChange({ ...content, experience: next });
                }}
                onBlur={() => onSave()}
              />
              <GhostInput
                className="text-[14px]"
                value={item.dates}
                placeholder="Dates"
                aria-label="Dates"
                onChange={(e) => {
                  const next = experience.map((row, idx) =>
                    idx === i ? { ...row, dates: e.target.value } : row,
                  );
                  onChange({ ...content, experience: next });
                }}
                onBlur={() => onSave()}
              />
              {(item.bullets.length ? item.bullets : [""]).map((bullet, bi) => (
                <GhostInput
                  key={bi}
                  className="text-[14px]"
                  value={bullet}
                  placeholder="A result, with a number if you have one"
                  aria-label="Result"
                  onChange={(e) => {
                    const bullets = (item.bullets.length ? item.bullets : [""]).map((b, idx) =>
                      idx === bi ? e.target.value : b,
                    );
                    const next = experience.map((row, idx) =>
                      idx === i ? { ...row, bullets } : row,
                    );
                    onChange({ ...content, experience: next });
                  }}
                  onBlur={() => onSave()}
                />
              ))}
              <PageAction
                onClick={() => {
                  const next = experience.map((row, idx) =>
                    idx === i ? { ...row, bullets: [...(row.bullets.length ? row.bullets : [""]), ""] } : row,
                  );
                  onSave({ ...content, experience: next });
                }}
              >
                Add a result
              </PageAction>
            </div>
          ))}
          <PageAction
            onClick={() =>
              onSave({
                ...content,
                experience: [
                  ...experience,
                  { id: newId(), org: "", role: "", dates: "", bullets: [""] },
                ],
              })
            }
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
                  const next = education.map((row, idx) =>
                    idx === i ? { ...row, school: e.target.value } : row,
                  );
                  onChange({ ...content, education: next });
                }}
                onBlur={() => onSave()}
              />
              <GhostInput
                className="text-[14px]"
                value={item.line}
                placeholder="Major, year"
                aria-label="Education"
                onChange={(e) => {
                  const next = education.map((row, idx) =>
                    idx === i ? { ...row, line: e.target.value } : row,
                  );
                  onChange({ ...content, education: next });
                }}
                onBlur={() => onSave()}
              />
            </div>
          ))}
          <PageAction
            onClick={() =>
              onSave({
                ...content,
                education: [...education, { id: newId(), school: "", line: "" }],
              })
            }
          >
            Add a school
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.skills ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide">Skills</h2>
          {skills.map((skill, i) => (
            <GhostInput
              key={i}
              className="mt-1 text-[14px]"
              value={skill}
              placeholder="A skill you can show"
              aria-label="Skill"
              onChange={(e) => {
                const next = skills.map((s, idx) => (idx === i ? e.target.value : s));
                onChange({ ...content, skills: next });
              }}
              onBlur={() => onSave()}
            />
          ))}
          <PageAction onClick={() => onSave({ ...content, skills: [...skills, ""] })}>
            Add a skill
          </PageAction>
        </section>
      ) : null}

      {!content.hidden.proof ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide">Proof</h2>
          {content.proofLines.length ? (
            content.proofLines.map((line) => (
              <p key={line} className="mt-1">
                {line}
              </p>
            ))
          ) : (
            <p className="mt-1 text-ink-faint">
              A published Proof appears here when you add it.
            </p>
          )}
        </section>
      ) : null}
    </article>
  );
}
