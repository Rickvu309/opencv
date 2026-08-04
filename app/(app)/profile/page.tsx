"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Folder,
  FolderGit2,
  Globe,
  GraduationCap,
  Mail,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/tip";
import {
  careerContext,
  profileBaseScore,
  profileSnapshot,
  user,
  vaultItems,
  type VaultItem,
  type VaultItemId,
} from "@/lib/data";
import { cn } from "@/lib/utils";

const vaultIcons: Record<VaultItemId, React.ElementType> = {
  cv: FileText,
  "cover-letter": Mail,
  linkedin: Globe,
  portfolio: Folder,
  github: FolderGit2,
};

type Experience = (typeof user.experience)[number];

/**
 * Count up to a new value (ease-out-quart). The ring and the % read from this
 * same value so they always move together. Reduced motion jumps instantly.
 */
function useCountUp(value: number) {
  const [display, setDisplay] = React.useState(0);
  const prev = React.useRef(0);

  React.useEffect(() => {
    const from = prev.current;
    prev.current = value;
    let raf = 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return display;
}

/** Completeness ring around the avatar — how LinkedIn gives a profile momentum. */
function CompletenessRing({
  pct,
  children,
}: {
  pct: number;
  children: React.ReactNode;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative size-24 shrink-0">
      <svg
        viewBox="0 0 96 96"
        aria-hidden
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx="48"
          cy="48"
          r={R}
          fill="none"
          strokeWidth="4"
          className="stroke-muted"
        />
        <circle
          cx="48"
          cy="48"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          className="stroke-foreground"
        />
      </svg>
      <div className="absolute inset-2.5 overflow-hidden rounded-full">
        {children}
      </div>
      <span className="absolute -right-1 -bottom-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

/**
 * The standard section frame: a 48px header (title left, actions right) and a
 * hairline-divided body. Editable sections flip to a draft mode with a
 * Cancel/Save bar at the foot; Esc cancels.
 */
function SectionPanel({
  title,
  meta,
  editing,
  onEdit,
  onCancel,
  onSave,
  className,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      onKeyDown={
        editing && onCancel
          ? (e) => {
              if (e.key === "Escape") onCancel();
            }
          : undefined
      }
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b pr-2 pl-4">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <div className="flex items-center gap-2">
          {meta}
          {onEdit && !editing && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </Button>
          )}
        </div>
      </div>
      {children}
      {editing && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Huỷ
          </Button>
          <Button size="sm" onClick={onSave}>
            Lưu thay đổi
          </Button>
        </div>
      )}
    </section>
  );
}

/** Local draft for one section: edit a copy, Save commits, Cancel discards. */
function useSectionEdit<T>(committed: T, onCommit: (v: T) => void) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<T>(committed);

  const start = React.useCallback(() => {
    setDraft(committed);
    setEditing(true);
  }, [committed]);

  const cancel = React.useCallback(() => setEditing(false), []);

  const save = React.useCallback(() => {
    onCommit(draft);
    setEditing(false);
    toast.success("Đã lưu thay đổi", {
      description: "Coach sẽ dùng thông tin mới trong các tư vấn tiếp theo.",
    });
  }, [draft, onCommit]);

  return { editing, draft, setDraft, start, cancel, save };
}

export default function ProfilePage() {
  const [added, setAdded] = React.useState<VaultItemId[]>([]);

  // Profile data lives in state so every section is editable in place.
  const [identity, setIdentity] = React.useState({
    name: user.name,
    role: `${user.targetRole} fresher`,
  });
  const [context, setContext] = React.useState(careerContext);
  const [experience, setExperience] = React.useState<Experience[]>(
    user.experience,
  );
  const [education, setEducation] = React.useState({
    school: user.school,
    major: user.major,
    year: user.year,
    gpa: user.gpa,
    courses: user.courses,
  });

  const idEdit = useSectionEdit(identity, setIdentity);
  const ctxEdit = useSectionEdit(context, setContext);
  const expEdit = useSectionEdit(experience, (v) =>
    setExperience(v.filter((e) => e.title.trim())),
  );
  const eduEdit = useSectionEdit(education, setEducation);
  const [newCourse, setNewCourse] = React.useState("");

  const isDone = React.useCallback(
    (item: VaultItem) => item.done || added.includes(item.id),
    [added],
  );
  const score =
    profileBaseScore +
    vaultItems.filter(isDone).reduce((n, i) => n + i.weight, 0);
  const display = useCountUp(score);
  const missing = vaultItems.filter((i) => !isDone(i));

  // The coach re-reads the profile live: fill the right gap and a weakness
  // leaves "needs work" for "strengths" — the read notices you changed.
  const isResolved = (w: (typeof profileSnapshot.weaknesses)[number]) =>
    !!w.resolvedBy && added.includes(w.resolvedBy);
  const openWeaknesses = profileSnapshot.weaknesses.filter((w) => !isResolved(w));
  const resolvedWeaknesses = profileSnapshot.weaknesses.filter(isResolved);

  function add(item: VaultItem) {
    const next = score + item.weight;
    setAdded((prev) => [...prev, item.id]);
    toast.success(`Đã thêm ${item.title}`, {
      description: `Hồ sơ đạt ${next}% — coach sẽ dùng nó ngay trong tư vấn.`,
    });
  }

  function addCourse() {
    const c = newCourse.trim();
    if (!c) return;
    eduEdit.setDraft((d) => ({ ...d, courses: [...d.courses, c] }));
    setNewCourse("");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      {/* Identity band: three lines, three levels — name, destination, background. */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <CompletenessRing pct={display}>
          <Avatar className="size-full">
            <AvatarFallback className="bg-card text-xl font-semibold ring-1 ring-border">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        </CompletenessRing>

        {idEdit.editing ? (
          <div
            className="min-w-0 flex-1 py-1"
            onKeyDown={(e) => {
              if (e.key === "Escape") idEdit.cancel();
            }}
          >
            <div className="grid max-w-md gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="id-name">Họ tên</Label>
                <Input
                  id="id-name"
                  autoFocus
                  value={idEdit.draft.name}
                  onChange={(e) =>
                    idEdit.setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="id-role">Vai trò hướng tới</Label>
                <Input
                  id="id-role"
                  value={idEdit.draft.role}
                  onChange={(e) =>
                    idEdit.setDraft((d) => ({ ...d, role: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={idEdit.save}>
                Lưu thay đổi
              </Button>
              <Button variant="ghost" size="sm" onClick={idEdit.cancel}>
                Huỷ
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 py-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                {identity.name}
              </h2>
              <p className="mt-1.5 text-sm">
                Hướng tới <span className="font-medium">{identity.role}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {education.school} · {education.major} · {education.year}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-1 shrink-0"
              onClick={idEdit.start}
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </Button>
          </>
        )}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Sticky right column: profile momentum + the coach's voice. */}
        <aside className="min-w-0 lg:order-2">
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-1">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Hoàn thiện hồ sơ
                  </h3>
                  <Tip title="Mức hoàn thiện tính thế nào?" className="-my-1">
                    Mỗi phần của hồ sơ đóng góp một trọng số — CV và portfolio
                    nặng nhất vì coach và nhà tuyển dụng dựa vào đó nhiều nhất.
                  </Tip>
                </div>
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {display}%
                </span>
              </div>
              <div className="px-4 pb-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${display}%` }}
                  />
                </div>
              </div>

              {missing.length > 0 ? (
                <ul className="divide-y divide-border border-t">
                  {missing.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => add(item)}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 motion-reduce:transition-none"
                      >
                        <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                          +{item.weight}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                  Hồ sơ đã đầy đủ — coach có mọi thứ cần thiết để tư vấn sát
                  nhất.
                </p>
              )}
            </div>

            {/* The coach's voice stays in view instead of being buried at the bottom. */}
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2.5 border-b px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Megaphone className="size-3" />
                </span>
                <h3 className="text-sm font-semibold tracking-tight">
                  Nhận định của coach
                </h3>
              </div>
              <p className="px-4 py-3 text-sm leading-relaxed">
                {profileSnapshot.summary}
              </p>
              {resolvedWeaknesses.length > 0 && (
                <p className="flex items-start gap-2 border-t bg-muted/40 px-4 py-2.5 text-xs leading-normal text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
                  <Megaphone className="mt-px size-3 shrink-0" />
                  <span className="min-w-0">
                    Vừa cập nhật: bạn đã gỡ được{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {resolvedWeaknesses.length}
                    </span>{" "}
                    điểm yếu trong hồ sơ.
                  </span>
                </p>
              )}
              <div className="border-t p-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                >
                  <Link
                    href={`/coach?q=${encodeURIComponent("Nhìn hồ sơ hiện tại, mình nên cải thiện gì trước?")}`}
                  >
                    Hỏi coach cách cải thiện
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:order-1">
          {/* The vault: one row per document — filled is readable, empty is an invitation. */}
          <SectionPanel
            title="Kho hồ sơ"
            meta={
              <span className="pr-2 text-xs text-muted-foreground tabular-nums">
                {vaultItems.filter(isDone).length}/{vaultItems.length} tài liệu
              </span>
            }
          >
            <ul className="divide-y divide-border">
              {vaultItems.map((item) => {
                const Icon = vaultIcons[item.id];
                const justAdded = added.includes(item.id);
                const done = isDone(item);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                        done
                          ? "bg-muted/60 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 basis-52">
                      <p className="text-sm font-medium">{item.title}</p>
                      {done ? (
                        <>
                          {item.meta && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.meta}
                            </p>
                          )}
                          {(justAdded ? item.addedNote : item.coachNote) && (
                            <p
                              className={cn(
                                "mt-1.5 flex items-start gap-1.5 text-xs leading-normal text-muted-foreground",
                                justAdded &&
                                  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
                              )}
                            >
                              <Megaphone className="mt-px size-3 shrink-0" />
                              <span className="min-w-0">
                                {justAdded ? item.addedNote : item.coachNote}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">
                          {item.benefit}
                        </p>
                      )}
                    </div>
                    {/* Actions stay at the right edge; when they wrap they align to the text column. */}
                    <div className="ml-13 flex shrink-0 items-center gap-1.5 sm:ml-0">
                      {done ? (
                        item.coachPrompt ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/coach?q=${encodeURIComponent(item.coachPrompt)}`}
                            >
                              <Megaphone className="size-3.5" />
                              Nhờ coach review
                            </Link>
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="font-normal">
                            <Check aria-hidden />
                            Đã có
                          </Badge>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => add(item)}
                        >
                          <Plus className="size-3.5" />
                          {item.addLabel}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionPanel>

          {/* Context: your real situation — what stops the advice being generic. */}
          <SectionPanel
            title="Bối cảnh & mục tiêu"
            className="mt-6"
            editing={ctxEdit.editing}
            onEdit={ctxEdit.start}
            onCancel={ctxEdit.cancel}
            onSave={ctxEdit.save}
          >
            <dl className="divide-y divide-border">
              {(ctxEdit.editing ? ctxEdit.draft : context).map((row, i) => (
                <div
                  key={row.label}
                  className="grid gap-y-0.5 px-4 py-2.5 sm:grid-cols-[8.5rem_1fr] sm:gap-3"
                >
                  <dt
                    className={cn(
                      "text-xs text-muted-foreground",
                      ctxEdit.editing ? "sm:self-center" : "sm:pt-0.5",
                    )}
                  >
                    <Label
                      htmlFor={ctxEdit.editing ? `ctx-${i}` : undefined}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {row.label}
                    </Label>
                  </dt>
                  <dd className="text-sm">
                    {ctxEdit.editing ? (
                      <Input
                        id={`ctx-${i}`}
                        autoFocus={i === 0}
                        value={row.value}
                        onChange={(e) =>
                          ctxEdit.setDraft((d) =>
                            d.map((r, j) =>
                              j === i ? { ...r, value: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionPanel>

          {/* Experience is a genuine sequence — hence the period column on the left. */}
          <SectionPanel
            title="Kinh nghiệm & hoạt động"
            className="mt-6"
            editing={expEdit.editing}
            onEdit={expEdit.start}
            onCancel={expEdit.cancel}
            onSave={expEdit.save}
          >
            {expEdit.editing ? (
              <div className="divide-y divide-border">
                {expEdit.draft.map((exp, i) => (
                  <div key={i} className="space-y-2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Vai trò"
                        placeholder="Vai trò (VD: Thực tập sinh Marketing)"
                        autoFocus={i === expEdit.draft.length - 1 && !exp.title}
                        value={exp.title}
                        onChange={(e) =>
                          expEdit.setDraft((d) =>
                            d.map((x, j) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground"
                        aria-label={`Xoá ${exp.title || "mục này"}`}
                        onClick={() =>
                          expEdit.setDraft((d) => d.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                      <Input
                        aria-label="Tổ chức"
                        placeholder="Tổ chức, công ty, CLB"
                        value={exp.org}
                        onChange={(e) =>
                          expEdit.setDraft((d) =>
                            d.map((x, j) =>
                              j === i ? { ...x, org: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Input
                        aria-label="Thời gian"
                        placeholder="06/2025 – 09/2025"
                        value={exp.period}
                        onChange={(e) =>
                          expEdit.setDraft((d) =>
                            d.map((x, j) =>
                              j === i ? { ...x, period: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <Textarea
                      aria-label="Bạn đã làm gì"
                      placeholder="Bạn đã làm gì, với số liệu nếu có"
                      className="min-h-14"
                      value={exp.detail}
                      onChange={(e) =>
                        expEdit.setDraft((d) =>
                          d.map((x, j) =>
                            j === i ? { ...x, detail: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() =>
                      expEdit.setDraft((d) => [
                        ...d,
                        { title: "", org: "", period: "", detail: "" },
                      ])
                    }
                  >
                    <Plus className="size-3.5" />
                    Thêm kinh nghiệm, hoạt động
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {experience.map((exp) => (
                    <li
                      key={exp.title}
                      className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr]"
                    >
                      <p className="text-xs text-muted-foreground tabular-nums sm:pt-0.5">
                        {exp.period}
                      </p>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {exp.title}
                          <span className="font-normal text-muted-foreground">
                            {" · "}
                            {exp.org}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {exp.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => {
                      expEdit.start();
                      expEdit.setDraft((d) => [
                        ...d,
                        { title: "", org: "", period: "", detail: "" },
                      ]);
                    }}
                  >
                    <Plus className="size-3.5" />
                    Thêm kinh nghiệm, hoạt động
                  </Button>
                </div>
              </>
            )}
          </SectionPanel>

          {/* Education & certificates */}
          <SectionPanel
            title="Học vấn & chứng chỉ"
            className="mt-6"
            editing={eduEdit.editing}
            onEdit={eduEdit.start}
            onCancel={eduEdit.cancel}
            onSave={eduEdit.save}
          >
            {eduEdit.editing ? (
              <>
                <div className="grid gap-x-2 gap-y-3 px-4 py-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="edu-school">Trường</Label>
                    <Input
                      id="edu-school"
                      autoFocus
                      value={eduEdit.draft.school}
                      onChange={(e) =>
                        eduEdit.setDraft((d) => ({
                          ...d,
                          school: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edu-major">Chuyên ngành</Label>
                    <Input
                      id="edu-major"
                      value={eduEdit.draft.major}
                      onChange={(e) =>
                        eduEdit.setDraft((d) => ({
                          ...d,
                          major: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edu-year">Năm học</Label>
                    <Input
                      id="edu-year"
                      value={eduEdit.draft.year}
                      onChange={(e) =>
                        eduEdit.setDraft((d) => ({ ...d, year: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edu-gpa">GPA</Label>
                    <Input
                      id="edu-gpa"
                      value={eduEdit.draft.gpa}
                      onChange={(e) =>
                        eduEdit.setDraft((d) => ({ ...d, gpa: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-3">
                  {eduEdit.draft.courses.map((course) => (
                    <Badge
                      key={course}
                      variant="secondary"
                      className="gap-1 pr-1 font-normal"
                    >
                      {course}
                      <button
                        type="button"
                        aria-label={`Xoá ${course}`}
                        onClick={() =>
                          eduEdit.setDraft((d) => ({
                            ...d,
                            courses: d.courses.filter((c) => c !== course),
                          }))
                        }
                        className="relative flex size-4 items-center justify-center rounded-full transition-colors outline-none after:absolute after:-inset-1.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCourse();
                      }
                    }}
                    onBlur={addCourse}
                    placeholder="Thêm chứng chỉ, nhấn Enter…"
                    aria-label="Thêm chứng chỉ"
                    className="h-6 min-w-40 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-xs"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60">
                    <GraduationCap className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{education.school}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {education.major} · {education.year} · GPA{" "}
                      <span className="tabular-nums">{education.gpa}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 border-t px-4 py-3">
                  {education.courses.map((course) => (
                    <Badge
                      key={course}
                      variant="secondary"
                      className="font-normal"
                    >
                      {course}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </SectionPanel>

          {/* The coach's read in two columns: keep vs fix. Authored by the coach, not editable. */}
          <SectionPanel title="Điểm mạnh & cần cải thiện" className="mt-6">
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Điểm mạnh
                </p>
                <ul className="mt-2 space-y-2.5">
                  {profileSnapshot.strengths.map((item) => (
                    <li key={item.title} className="flex gap-2.5">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                  {/* A just-resolved weakness lands here — crossing columns is the reward. */}
                  {resolvedWeaknesses.map((item) => (
                    <li
                      key={item.title}
                      className="flex gap-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-success"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                          {item.title.replace(/^Chưa /, "Đã ")}
                          <Badge
                            variant="secondary"
                            className="font-normal text-muted-foreground"
                          >
                            Vừa khắc phục
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {item.resolvedNote ?? item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Cần cải thiện
                </p>
                {openWeaknesses.length > 0 ? (
                  <ul className="mt-2 space-y-2.5">
                    {openWeaknesses.map((item) => (
                      <li key={item.title} className="flex gap-2.5">
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Không còn điểm yếu nào coach ghi nhận — giữ nhịp này nhé.
                  </p>
                )}
              </div>
            </div>
          </SectionPanel>
        </div>
      </div>
    </div>
  );
}
