"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  actionPlan,
  gapAnalysis,
  opportunities,
  selectedOpportunityId,
  type Opportunity,
  type SkillLevel,
} from "@/lib/data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";

function readinessOf(opportunity: Opportunity) {
  if (opportunity.id === selectedOpportunityId) return gapAnalysis.readiness;
  return Math.round(
    (opportunity.skills.reduce((sum, s) => sum + Math.min(s.current / s.target, 1), 0) /
      opportunity.skills.length) *
      100,
  );
}

const planItems = actionPlan.flatMap((phase) =>
  phase.items.map((item) => ({ ...item, period: phase.period })),
);

/** Plan items naming this skill (the plan belongs to the current path only). */
function planItemFor(skillName: string) {
  const key = skillName.split(/[(/]/)[0].trim().toLowerCase();
  return planItems.find((item) =>
    `${item.title} ${item.description}`.toLowerCase().includes(key),
  );
}

/** One short line spelling out what closing this gap actually means. */
function gapAdvice(skill: SkillLevel, role: string) {
  const gap = skill.target - skill.current;
  if (gap <= 0) {
    return `Bạn đã đạt mức ${skill.target} mà vị trí ${role} yêu cầu. Giữ nhịp dùng năng lực này trong công việc thật để không mai một.`;
  }

  const focus = skill.note ? ` Phần cần bù nằm ở ${skill.note.toLowerCase()}.` : "";
  const effort =
    gap >= 30
      ? "Khoảng cách còn lớn: cần một khoá học bài bản rồi làm ít nhất một sản phẩm thật để chứng minh."
      : gap >= 15
        ? "Khoảng cách vừa phải: luyện đều 20–30 phút mỗi ngày trong vài tuần là bù được."
        : "Gần tới đích: dùng năng lực này trong một dự án thật là đủ để chạm mục tiêu.";

  return `Còn thiếu ${gap} điểm để đạt mức ${skill.target} mà vị trí ${role} yêu cầu.${focus} ${effort}`;
}

/** Track = untargeted, haze = the gap still to close, ink = attained, tick = target. */
function SkillBar({ current, target }: { current: number; target: number }) {
  return (
    <div className="relative h-2">
      <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
        <div
          className="animate-bar-grow absolute inset-y-0 left-0 rounded-full bg-chart-2"
          style={{ width: `${target}%` }}
        />
        <div
          className="animate-bar-grow absolute inset-y-0 left-0 rounded-full bg-chart-1"
          style={{ width: `${current}%` }}
        />
      </div>
      <span
        className="absolute top-1/2 h-3.5 w-0.5 -translate-x-px -translate-y-1/2 rounded-full bg-foreground"
        style={{ left: `${target}%` }}
        aria-hidden
      />
    </div>
  );
}

export default function CareerMapPage() {
  const [selectedId, setSelectedId] = React.useState(selectedOpportunityId);
  const [currentPath, setCurrentPath] = React.useState(selectedOpportunityId);

  const opportunity =
    opportunities.find((o) => o.id === selectedId) ?? opportunities[0];

  const skills = [...opportunity.skills].sort(
    (a, b) => b.target - b.current - (a.target - a.current),
  );
  const readiness = readinessOf(opportunity);
  const biggestGap = skills[0];
  const isCurrentPath = opportunity.id === currentPath;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <p className="text-sm text-muted-foreground">
        Chọn một hướng đi để xem bạn đang ở đâu so với yêu cầu của vị trí đó.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr] lg:items-start">
        {/* Path picker */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Hướng đi ({opportunities.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {opportunities.map((o) => {
              const active = o.id === selectedId;
              const r = readinessOf(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full px-4 py-3 text-left transition-colors motion-reduce:transition-none ${
                    active ? "bg-muted/60" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{o.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {r}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${r}%` }}
                    />
                  </div>
                  {o.id === currentPath && (
                    <Badge
                      variant="outline"
                      className="mt-2 font-normal text-muted-foreground"
                    >
                      <Check className="size-3" aria-hidden />
                      Hướng đi hiện tại
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected path detail */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-tight">
                  {opportunity.title}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {opportunity.tagline}
                </p>
              </div>
              {isCurrentPath ? (
                <Badge
                  variant="outline"
                  className="mt-1 font-normal text-muted-foreground"
                >
                  <Check className="size-3" aria-hidden />
                  Hướng đi hiện tại
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCurrentPath(opportunity.id);
                    toast.success(`Đã chuyển hướng đi sang ${opportunity.title}`, {
                      description:
                        "Kế hoạch hành động sẽ được cập nhật theo hướng mới.",
                    });
                  }}
                >
                  Chọn hướng này
                </Button>
              )}
            </div>
          </div>

          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <div className="flex h-5 items-center gap-1">
                <p className="text-xs text-muted-foreground">Mức sẵn sàng</p>
                <Tip title="Mức sẵn sàng được tính thế nào?">
                  Là trung bình mức bạn đã đạt trên từng năng lực mà vị trí này
                  yêu cầu — năng lực nào đã chạm hoặc vượt mục tiêu thì tính là
                  đủ. Đây là ước lượng để theo dõi tiến độ, không phải điểm chấm.
                </Tip>
              </div>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {readiness}%
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="flex h-5 items-center text-xs text-muted-foreground">
                Khoảng cách lớn nhất
              </p>
              <p className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {biggestGap.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                cần thêm {biggestGap.target - biggestGap.current} điểm
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="flex h-5 items-center text-xs text-muted-foreground">
                Thời gian dự kiến
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {opportunity.timeToReady}
              </p>
            </div>
          </div>

          {/* Skill bars */}
          <div className="border-t">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b bg-muted/50 px-5 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Năng lực · sắp theo khoảng cách
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-chart-1" />
                  Hiện tại
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-chart-2" />
                  Cần bù
                </span>
              </div>
            </div>

            {/* keyed by path: switching path replays the bar growth. */}
            <Accordion
              key={selectedId}
              type="single"
              collapsible
              className="divide-y divide-border"
            >
              {skills.map((skill) => {
                const linked = planItemFor(skill.name);
                return (
                  <AccordionItem
                    key={skill.name}
                    value={skill.name}
                    className="border-b-0"
                  >
                    <AccordionTrigger className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:no-underline data-[state=open]:bg-muted/40 [&_[data-slot=accordion-trigger-icon]]:hidden sm:grid-cols-[180px_1fr_72px_auto]">
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium">
                          {skill.name}
                        </p>
                        {skill.note && (
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {skill.note}
                          </p>
                        )}
                      </div>
                      <div className="col-span-3 sm:col-span-1">
                        <SkillBar current={skill.current} target={skill.target} />
                      </div>
                      <p className="text-right text-sm font-normal tabular-nums">
                        <span className="font-medium">{skill.current}</span>
                        <span className="text-muted-foreground">
                          /{skill.target}
                        </span>
                      </p>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none" />
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4">
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                        {gapAdvice(skill, opportunity.title)}
                      </p>
                      {linked && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Trong kế hoạch:{" "}
                          <Link
                            href="/plan"
                            className="font-medium text-foreground underline underline-offset-4"
                          >
                            {linked.title}
                          </Link>{" "}
                          · {linked.period}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3.5">
            <p className="text-sm text-muted-foreground">
              Cần bù{" "}
              {skills.reduce((n, s) => n + Math.max(s.target - s.current, 0), 0)} điểm
              năng lực để sẵn sàng ứng tuyển.
            </p>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/coach">Hỏi coach</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/plan">
                  Xem kế hoạch
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
