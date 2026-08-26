/**
 * CV print-paper templates. Arbitrary pixel sizes and the product-sidebar
 * hex stay here on purpose — print layout is a documented ADR-0010 exception.
 */
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ImagePlus, User } from "lucide-react"

import type { CvData, CvEducation, CvExperience } from "./paper-cv-types.ts"

type FieldProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  multiline?: boolean
  "aria-label": string
}

export function EditableField({
  value,
  onChange,
  className,
  multiline,
  "aria-label": ariaLabel,
}: FieldProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const Tag = "span"

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.textContent !== value) el.textContent = value
  }, [value])

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      className={cn(
        "outline-none empty:before:text-muted-foreground/50 empty:before:content-[attr(data-placeholder)] focus:rounded-sm focus:bg-muted/80 focus:ring-1 focus:ring-ring/40",
        multiline && "block",
        className
      )}
      data-placeholder="Add text…"
    />
  )
}

type Props = {
  data: CvData
  onChange: (data: CvData) => void
}

export function CvDocument({ data, onChange }: Props) {
  function patch<K extends keyof CvData>(key: K, value: CvData[K]) {
    onChange({ ...data, [key]: value })
  }

  function patchExperience(index: number, next: Partial<CvExperience>) {
    const experience = data.experience.map((item, i) =>
      i === index ? { ...item, ...next } : item
    )
    patch("experience", experience)
  }

  function patchEducation(index: number, next: Partial<CvEducation>) {
    const education = data.education.map((item, i) =>
      i === index ? { ...item, ...next } : item
    )
    patch("education", education)
  }

  switch (data.templateId) {
    case "product":
      return (
        <ProductCv
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
        />
      )
    case "service":
      return (
        <ServiceCv
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
        />
      )
    case "academic":
      return (
        <AcademicCv
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
        />
      )
    case "photo":
      return (
        <PhotoCv
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
        />
      )
    default:
      return (
        <InternshipCv
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
        />
      )
  }
}

type TemplateProps = {
  data: CvData
  patch: <K extends keyof CvData>(key: K, value: CvData[K]) => void
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  patchEducation: (index: number, next: Partial<CvEducation>) => void
}

function ContactLine({
  data,
  patch,
  className,
}: TemplateProps & { className?: string }) {
  const { contact } = data
  const parts = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
  ].filter(Boolean)

  return (
    <p className={cn("text-[11px] leading-relaxed", className)}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span className="mx-1.5 text-border">|</span> : null}
          <EditableField
            aria-label="Contact detail"
            value={part ?? ""}
            onChange={(value) => {
              const keys: (keyof typeof contact)[] = [
                "email",
                "phone",
                "location",
                "linkedin",
              ]
              const key = keys[i]
              if (key) patch("contact", { ...contact, [key]: value })
            }}
          />
        </span>
      ))}
    </p>
  )
}

function ExperienceBlock({
  item,
  index,
  patchExperience,
  dark,
}: {
  item: CvExperience
  index: number
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  dark?: boolean
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className={cn("text-sm font-semibold", dark && "text-white")}>
          <EditableField
            aria-label="Role"
            value={item.role}
            onChange={(role) => patchExperience(index, { role })}
          />
          <span
            className={cn(
              "font-normal",
              dark ? "text-white/60" : "text-muted-foreground"
            )}
          >
            {" "}
            ·{" "}
          </span>
          <EditableField
            aria-label="Company"
            value={item.company}
            onChange={(company) => patchExperience(index, { company })}
          />
        </p>
        <p
          className={cn(
            "shrink-0 text-[11px] font-medium tracking-wide uppercase",
            dark ? "text-white/50" : "text-muted-foreground"
          )}
        >
          <EditableField
            aria-label="Period"
            value={item.period}
            onChange={(period) => patchExperience(index, { period })}
          />
        </p>
      </div>
      {item.location ? (
        <p
          className={cn(
            "mt-0.5 text-xs",
            dark ? "text-white/50" : "text-muted-foreground"
          )}
        >
          <EditableField
            aria-label="Location"
            value={item.location}
            onChange={(location) => patchExperience(index, { location })}
          />
        </p>
      ) : null}
      <ul
        className={cn(
          "mt-2 space-y-1.5",
          dark ? "text-white/85" : "text-foreground/85"
        )}
      >
        {item.bullets.map((bullet, bi) => (
          <li key={bi} className="flex gap-2 text-[13px] leading-relaxed">
            <span
              className={cn(
                "mt-2 size-1 shrink-0 rounded-full",
                dark ? "bg-white/50" : "bg-foreground/40"
              )}
            />
            <EditableField
              aria-label="Bullet point"
              value={bullet}
              multiline
              className="flex-1"
              onChange={(value) => {
                const bullets = [...item.bullets]
                bullets[bi] = value
                patchExperience(index, { bullets })
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionTitle({
  children,
  dark,
}: {
  children: ReactNode
  dark?: boolean
}) {
  return (
    <h3
      className={cn(
        "mb-2 border-b pb-1 text-[10px] font-bold tracking-[0.14em] uppercase",
        dark
          ? "border-white/20 text-white/70"
          : "border-foreground/15 text-foreground/55"
      )}
    >
      {children}
    </h3>
  )
}

function CvPhoto({
  url,
  onChange,
}: {
  url?: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(URL.createObjectURL(file))
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        aria-label={url ? "Change profile photo" : "Add profile photo"}
        className="group cv-template-photo-slot relative h-auto shrink-0 overflow-hidden rounded-md border border-foreground/15 bg-muted/30 p-0 hover:border-foreground/30 hover:bg-muted/50"
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <User className="size-6 opacity-50" strokeWidth={1.5} />
            <ImagePlus className="size-3.5 opacity-60" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-1 py-0.5 text-3xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
          {url ? "Change" : "Add photo"}
        </span>
      </Button>
    </>
  )
}

function InternshipCv({
  data,
  patch,
  patchExperience,
  patchEducation,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-internship">
      <header className="border-b border-foreground/10 pb-4 text-center">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
          <EditableField
            aria-label="Full name"
            value={data.name}
            onChange={(name) => patch("name", name)}
          />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            onChange={(headline) => patch("headline", headline)}
          />
        </p>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="mt-3 justify-center text-muted-foreground"
        />
      </header>

      <section className="mt-5">
        <SectionTitle>Summary</SectionTitle>
        <EditableField
          aria-label="Summary"
          value={data.summary}
          multiline
          className="text-[13px] leading-relaxed text-foreground/90"
          onChange={(summary) => patch("summary", summary)}
        />
      </section>

      <section className="mt-5">
        <SectionTitle>Experience</SectionTitle>
        {data.experience.map((item, i) => (
          <ExperienceBlock
            key={i}
            item={item}
            index={i}
            patchExperience={patchExperience}
          />
        ))}
      </section>

      <section className="mt-5">
        <SectionTitle>Education</SectionTitle>
        {data.education.map((item, i) => (
          <div key={i} className="mb-3 last:mb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  onChange={(school) => patchEducation(i, { school })}
                />
              </p>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <EditableField
                  aria-label="Period"
                  value={item.period}
                  onChange={(period) => patchEducation(i, { period })}
                />
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              <EditableField
                aria-label="Degree"
                value={item.degree}
                onChange={(degree) => patchEducation(i, { degree })}
              />
            </p>
            {item.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <EditableField
                  aria-label="Education detail"
                  value={item.detail}
                  onChange={(detail) => patchEducation(i, { detail })}
                />
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-5">
        <SectionTitle>Skills</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {data.skills
            .flatMap((g) => g.items)
            .map((skill, i) => (
              <span
                key={i}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
        </div>
      </section>
    </div>
  )
}

function PhotoCv({
  data,
  patch,
  patchExperience,
  patchEducation,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-photo">
      <header className="mb-5 flex gap-4 border-b border-foreground/10 pb-4">
        <CvPhoto
          url={data.photoUrl}
          onChange={(photoUrl) => patch("photoUrl", photoUrl)}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
            <EditableField
              aria-label="Full name"
              value={data.name}
              onChange={(name) => patch("name", name)}
            />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <EditableField
              aria-label="Headline"
              value={data.headline}
              onChange={(headline) => patch("headline", headline)}
            />
          </p>
          <ContactLine
            data={data}
            patch={patch}
            patchExperience={patchExperience}
            patchEducation={patchEducation}
            className="mt-2.5 text-muted-foreground"
          />
        </div>
      </header>

      <section className="mb-5">
        <SectionTitle>Summary</SectionTitle>
        <EditableField
          aria-label="Summary"
          value={data.summary}
          multiline
          className="text-[13px] leading-relaxed text-foreground/90"
          onChange={(summary) => patch("summary", summary)}
        />
      </section>

      <section className="mb-5">
        <SectionTitle>Experience</SectionTitle>
        {data.experience.map((item, i) => (
          <ExperienceBlock
            key={i}
            item={item}
            index={i}
            patchExperience={patchExperience}
          />
        ))}
      </section>

      <section className="mb-5">
        <SectionTitle>Education</SectionTitle>
        {data.education.map((item, i) => (
          <div key={i} className="mb-3 last:mb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  onChange={(school) => patchEducation(i, { school })}
                />
              </p>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <EditableField
                  aria-label="Period"
                  value={item.period}
                  onChange={(period) => patchEducation(i, { period })}
                />
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              <EditableField
                aria-label="Degree"
                value={item.degree}
                onChange={(degree) => patchEducation(i, { degree })}
              />
            </p>
            {item.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <EditableField
                  aria-label="Education detail"
                  value={item.detail}
                  onChange={(detail) => patchEducation(i, { detail })}
                />
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section>
        <SectionTitle>Skills</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {data.skills
            .flatMap((g) => g.items)
            .map((skill, i) => (
              <span
                key={i}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
        </div>
      </section>
    </div>
  )
}

function ProductCv({
  data,
  patch,
  patchExperience,
  patchEducation,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-root--product cv-template-product">
      <aside className="cv-template-product-sidebar bg-[#1e293b] text-white">
        <h1 className="text-lg leading-tight font-semibold">
          <EditableField
            aria-label="Full name"
            value={data.name}
            className="text-white"
            onChange={(name) => patch("name", name)}
          />
        </h1>
        <p className="mt-2 text-sm text-white/70">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            className="text-white/70"
            onChange={(headline) => patch("headline", headline)}
          />
        </p>

        <div className="mt-6 space-y-1.5 text-xs text-white/75">
          <EditableField
            aria-label="Email"
            value={data.contact.email}
            className="block text-white/75"
            onChange={(email) => patch("contact", { ...data.contact, email })}
          />
          <EditableField
            aria-label="Phone"
            value={data.contact.phone}
            className="block text-white/75"
            onChange={(phone) => patch("contact", { ...data.contact, phone })}
          />
          <EditableField
            aria-label="Location"
            value={data.contact.location}
            className="block text-white/75"
            onChange={(location) =>
              patch("contact", { ...data.contact, location })
            }
          />
          {data.contact.linkedin ? (
            <EditableField
              aria-label="LinkedIn"
              value={data.contact.linkedin}
              className="block text-white/75"
              onChange={(linkedin) =>
                patch("contact", { ...data.contact, linkedin })
              }
            />
          ) : null}
        </div>

        <div className="mt-6">
          <SectionTitle dark>Skills</SectionTitle>
          <div className="space-y-3">
            {data.skills.map((group, gi) => (
              <div key={gi}>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-white/45 uppercase">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.items.map((item, ii) => (
                    <span
                      key={ii}
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/85"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <SectionTitle dark>Education</SectionTitle>
          {data.education.map((item, i) => (
            <div key={i} className="mb-3 text-xs text-white/80">
              <p className="font-semibold text-white">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  className="text-white"
                  onChange={(school) => patchEducation(i, { school })}
                />
              </p>
              <p className="text-white/60">
                <EditableField
                  aria-label="Degree"
                  value={item.degree}
                  className="text-white/60"
                  onChange={(degree) => patchEducation(i, { degree })}
                />
              </p>
              <p className="text-[10px] text-white/45">
                <EditableField
                  aria-label="Period"
                  value={item.period}
                  className="text-white/45"
                  onChange={(period) => patchEducation(i, { period })}
                />
              </p>
            </div>
          ))}
        </div>
      </aside>

      <main className="cv-template-product-main">
        <section>
          <SectionTitle>Profile</SectionTitle>
          <EditableField
            aria-label="Summary"
            value={data.summary}
            multiline
            className="text-[13px] leading-relaxed text-foreground/90"
            onChange={(summary) => patch("summary", summary)}
          />
        </section>

        <section className="mt-6">
          <SectionTitle>Experience</SectionTitle>
          {data.experience.map((item, i) => (
            <ExperienceBlock
              key={i}
              item={item}
              index={i}
              patchExperience={patchExperience}
            />
          ))}
        </section>

        {data.projects?.length ? (
          <section className="mt-6">
            <SectionTitle>Selected work</SectionTitle>
            {data.projects.map((project, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-semibold">
                  <EditableField
                    aria-label="Project name"
                    value={project.name}
                    onChange={(name) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, name }
                      patch("projects", projects)
                    }}
                  />
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  <EditableField
                    aria-label="Project detail"
                    value={project.detail}
                    multiline
                    onChange={(detail) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, detail }
                      patch("projects", projects)
                    }}
                  />
                </p>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  )
}

function ServiceCv({
  data,
  patch,
  patchExperience,
  patchEducation,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-service">
      <header className="mb-5">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight uppercase">
          <EditableField
            aria-label="Full name"
            value={data.name}
            onChange={(name) => patch("name", name)}
          />
        </h1>
        <p className="mt-1 text-base font-medium text-foreground/70">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            onChange={(headline) => patch("headline", headline)}
          />
        </p>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="mt-2 text-muted-foreground"
        />
      </header>

      <section className="rounded-lg border border-foreground/10 bg-muted/20 p-4">
        <SectionTitle>Work experience</SectionTitle>
        {data.experience.map((item, i) => (
          <ExperienceBlock
            key={i}
            item={item}
            index={i}
            patchExperience={patchExperience}
          />
        ))}
      </section>

      <section className="mt-5">
        <SectionTitle>About</SectionTitle>
        <EditableField
          aria-label="Summary"
          value={data.summary}
          multiline
          className="text-[13px] leading-relaxed"
          onChange={(summary) => patch("summary", summary)}
        />
      </section>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <section>
          <SectionTitle>Education</SectionTitle>
          {data.education.map((item, i) => (
            <div key={i} className="mb-2 text-sm">
              <p className="font-semibold">{item.school}</p>
              <p className="text-muted-foreground">{item.degree}</p>
              <p className="text-xs text-muted-foreground">{item.period}</p>
            </div>
          ))}
        </section>
        <section>
          <SectionTitle>Skills</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {data.skills
              .flatMap((g) => g.items)
              .map((skill, i) => (
                <span
                  key={i}
                  className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-medium text-background"
                >
                  {skill}
                </span>
              ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function AcademicCv({
  data,
  patch,
  patchExperience,
  patchEducation,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-academic">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
        <div>
          <h1 className="text-2xl font-semibold">
            <EditableField
              aria-label="Full name"
              value={data.name}
              onChange={(name) => patch("name", name)}
            />
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <EditableField
              aria-label="Headline"
              value={data.headline}
              onChange={(headline) => patch("headline", headline)}
            />
          </p>
        </div>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="text-right text-muted-foreground"
        />
      </header>

      <section className="mb-5">
        <SectionTitle>Education</SectionTitle>
        {data.education.map((item, i) => (
          <div key={i} className="mb-3 flex gap-4">
            <p className="w-24 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <EditableField
                aria-label="Period"
                value={item.period}
                onChange={(period) => patchEducation(i, { period })}
              />
            </p>
            <div>
              <p className="text-sm font-semibold">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  onChange={(school) => patchEducation(i, { school })}
                />
              </p>
              <p className="text-sm text-muted-foreground">
                <EditableField
                  aria-label="Degree"
                  value={item.degree}
                  onChange={(degree) => patchEducation(i, { degree })}
                />
              </p>
              {item.detail ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      {data.projects?.length ? (
        <section className="mb-5">
          <SectionTitle>Projects & campus</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {data.projects.map((project, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/20 p-3"
              >
                <p className="text-sm font-semibold">{project.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {project.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-5">
        <SectionTitle>Experience</SectionTitle>
        {data.experience.map((item, i) => (
          <ExperienceBlock
            key={i}
            item={item}
            index={i}
            patchExperience={patchExperience}
          />
        ))}
      </section>

      <section>
        <SectionTitle>Skills & languages</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {data.skills
            .flatMap((g) => g.items)
            .map((skill, i) => (
              <span
                key={i}
                className="rounded border border-dashed border-border px-2 py-0.5 text-xs"
              >
                {skill}
              </span>
            ))}
        </div>
      </section>
    </div>
  )
}
