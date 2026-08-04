"use client";

import * as React from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import {
  actionPlan,
  gapAnalysis,
  opportunities,
  selectedOpportunityId,
  user,
} from "@/lib/data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

/** Status dot colour for priority — the text itself stays monochrome. */
const severityDot: Record<string, string> = {
  "Quan trọng nhất": "bg-danger",
  "Quan trọng": "bg-warning",
  "Nên có": "bg-muted-foreground",
};

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Starting column of each phase on the 9-month grid. */
const phaseColStart = ["col-start-1", "col-start-4", "col-start-7"];

/** Thin progress bar with its value inline on the right. */
function ProgressRow({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums">{label}</span>
    </div>
  );
}

export default function PlanPage() {
  const initialDone = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const phase of actionPlan) {
      for (const item of phase.items) map[item.id] = item.done;
    }
    return map;
  }, []);
  const [done, setDone] = React.useState(initialDone);
  const [view, setView] = React.useState<"list" | "timeline">("list");

  const totalItems = Object.keys(done).length;
  const doneCount = Object.values(done).filter(Boolean).length;
  const progress = totalItems === 0 ? 0 : (doneCount / totalItems) * 100;

  const target = opportunities.find((o) => o.id === selectedOpportunityId);
  const biggestGap = gapAnalysis.gaps[0];

  const toggle = (id: string, title: string, checked: boolean) => {
    setDone((prev) => ({ ...prev, [id]: checked }));
    if (checked) {
      const remaining = totalItems - doneCount - 1;
      toast.success(`Đã xong: ${title}`, {
        description:
          remaining > 0
            ? `Còn ${remaining} việc nữa trong kế hoạch. Cứ đều đặn là tới.`
            : "Bạn đã hoàn thành toàn bộ kế hoạch. Xứng đáng tự hào!",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Khoảng cách giữa bạn hôm nay và vị trí {user.targetRole}, cùng lộ
            trình 9 tháng để thu hẹp nó — từng việc một.
          </p>
        </div>

        <div className="w-full shrink-0 sm:w-60">
          <p className="flex h-5 items-center text-xs text-muted-foreground">
            Tiến độ kế hoạch
          </p>
          <ProgressRow
            className="mt-2"
            value={progress}
            label={`${doneCount} / ${totalItems}`}
          />
        </div>
      </div>

      {/* Gap analysis */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          Phân tích khoảng cách
        </h2>

        {/* Metrics strip */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex flex-col px-5 py-4">
              <div className="flex h-5 items-center gap-1">
                <p className="text-xs text-muted-foreground">Mức sẵn sàng</p>
                <Tip title="Mức sẵn sàng được tính thế nào?">
                  Là tỷ lệ kỹ năng bạn đã đạt tới mức mà tin tuyển dụng fresher
                  thường đòi hỏi. Càng gần 100%, hồ sơ của bạn càng khớp với mô
                  tả công việc thật ngoài thị trường.
                </Tip>
              </div>
              <ProgressRow
                className="mt-4"
                value={gapAnalysis.readiness}
                label={`${gapAnalysis.readiness}%`}
              />
              <p className="mt-auto pt-3 text-xs text-muted-foreground">
                So với yêu cầu chung của tin tuyển dụng fresher
              </p>
            </div>
            <div className="flex flex-col px-5 py-4">
              <div className="flex h-5 items-center gap-1">
                <p className="text-xs text-muted-foreground">
                  Khoảng cách lớn nhất
                </p>
                <Tip title="Vì sao là kỹ năng này?">
                  Đây là kỹ năng còn cách mục tiêu xa nhất trong hồ sơ của bạn.
                  Bù nó trước sẽ kéo mức sẵn sàng lên nhanh nhất, nên hãy coi
                  đây là việc ưu tiên số một.
                </Tip>
              </div>
              <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight">
                {biggestGap.skill}
              </p>
              <p className="mt-auto pt-3 text-xs text-muted-foreground">
                Xuất hiện trong hầu hết tin tuyển dụng
              </p>
            </div>
            <div className="flex flex-col px-5 py-4">
              <p className="flex h-5 items-center text-xs text-muted-foreground">
                Thời gian dự kiến
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {target?.timeToReady}
              </p>
              <p className="mt-auto pt-3 text-xs text-muted-foreground">
                Với nhịp học hiện tại của bạn
              </p>
            </div>
          </div>
        </div>

        {/* Gap list */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2.5">
            <span className="w-36 shrink-0 text-xs text-muted-foreground">
              Mức độ ưu tiên
            </span>
            <span className="text-xs text-muted-foreground">
              Kỹ năng cần bù
            </span>
          </div>

          <div className="divide-y divide-border">
            {gapAnalysis.gaps.map((gap) => (
              <div
                key={gap.skill}
                className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="w-36 shrink-0">
                  <Badge variant="outline" className="font-medium">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        severityDot[gap.severity] ?? severityDot["Nên có"],
                      )}
                      aria-hidden
                    />
                    {gap.severity}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{gap.skill}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {gap.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 border-t bg-muted/40 px-4 py-3">
            <TrendingUp
              className="mt-px size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                Dữ liệu thị trường ·{" "}
              </span>
              {gapAnalysis.marketNote}
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Lộ trình</h2>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {view === "list"
                  ? "Mở giai đoạn bạn đang làm, tick việc đã xong"
                  : "9 tháng · 3 giai đoạn"}
              </span>
              {view === "timeline" ? (
                <Tip title="Tháng ở đây tính từ hôm nay">
                  Các mốc tháng được tính từ thời điểm hiện tại chứ không phải
                  tháng theo lịch — “Tháng 1” nghĩa là 30 ngày tới, không phải
                  tháng Một.
                </Tip>
              ) : null}
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
              {(
                [
                  { key: "list", label: "Danh sách" },
                  { key: "timeline", label: "Dòng thời gian" },
                ] as const
              ).map((option) => {
                const isActive = view === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setView(option.key)}
                    aria-pressed={isActive}
                    className={cn(
                      "h-7 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {view === "timeline" ? (
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Month header row */}
                <div className="grid grid-cols-[180px_1fr] border-b bg-muted/50">
                  <div className="border-r border-border px-4 py-2.5 text-xs text-muted-foreground">
                    Giai đoạn
                  </div>
                  <div className="grid grid-cols-9 divide-x divide-border">
                    {months.map((month) => (
                      <div
                        key={month}
                        className="px-2.5 py-2.5 text-xs text-muted-foreground tabular-nums"
                      >
                        Tháng {month}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  {/* Background vertical grid */}
                  <div
                    className="pointer-events-none absolute inset-0 grid grid-cols-[180px_1fr]"
                    aria-hidden
                  >
                    <div className="border-r border-border" />
                    <div className="grid grid-cols-9 divide-x divide-border">
                      {months.map((month) => (
                        <div key={month} />
                      ))}
                    </div>
                  </div>

                  {/* One row per phase */}
                  <div className="relative divide-y divide-border">
                    {actionPlan.map((phase, index) => {
                      const total = phase.items.length;
                      const phaseDone = phase.items.filter(
                        (i) => done[i.id],
                      ).length;
                      const ratio = total === 0 ? 0 : (phaseDone / total) * 100;
                      return (
                        <div
                          key={phase.id}
                          className="grid grid-cols-[180px_1fr] items-center"
                        >
                          <div className="min-w-0 px-4 py-3">
                            <p className="text-sm font-medium leading-snug">
                              {phase.label}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {phase.period}
                            </p>
                          </div>
                          <div className="grid grid-cols-9 py-2.5">
                            <div
                              className={cn(
                                "relative col-span-3 overflow-hidden rounded-md bg-muted px-3 py-2",
                                phaseColStart[index],
                              )}
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-foreground/20 transition-[width] duration-200 ease-out motion-reduce:transition-none"
                                style={{ width: `${ratio}%` }}
                                aria-hidden
                              />
                              <div className="relative flex items-baseline justify-between gap-3">
                                <span className="truncate text-xs font-medium">
                                  {phase.goal}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                  {phaseDone}/{total}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Today marker */}
                  <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-[180px_1fr]">
                    <div />
                    <div className="grid grid-cols-9">
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 left-1/3 w-px bg-foreground/40"
                          aria-hidden
                        />
                        <span className="absolute bottom-2.5 left-1/3 ml-1.5 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                          hôm nay
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            <Accordion type="multiple" defaultValue={[actionPlan[0].id]}>
              {actionPlan.map((phase) => {
                const total = phase.items.length;
                const phaseDone = phase.items.filter((i) => done[i.id]).length;
                const ratio = total === 0 ? 0 : (phaseDone / total) * 100;
                return (
                  <AccordionItem key={phase.id} value={phase.id}>
                    <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3 transition-colors duration-200 ease-out hover:bg-muted/40 hover:no-underline focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none [&_[data-slot=accordion-trigger-icon]]:hidden">
                      <ChevronDown
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold tracking-tight">
                            {phase.label}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            · {phase.period}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Mục tiêu: {phase.goal}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant="outline"
                          className="font-normal tabular-nums"
                        >
                          {phaseDone}/{total} xong
                        </Badge>
                        <span
                          className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none"
                            style={{ width: `${ratio}%` }}
                          />
                        </span>
                      </span>
                    </AccordionTrigger>

                    <AccordionContent className="p-0 [&_p:not(:last-child)]:mb-0">
                      <div className="divide-y divide-border border-t">
                        {phase.items.map((item) => {
                          const isDone = done[item.id];
                          return (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 px-4 py-3 transition-colors duration-200 ease-out hover:bg-muted/40 motion-reduce:transition-none"
                            >
                              <Checkbox
                                id={item.id}
                                checked={isDone}
                                onCheckedChange={(checked) =>
                                  toggle(item.id, item.title, checked === true)
                                }
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-6">
                                <div className="min-w-0 flex-1">
                                  {/* min-h-6: the 24px minimum target size from WCAG 2.2. */}
                                  <Label
                                    htmlFor={item.id}
                                    className={cn(
                                      "flex min-h-6 items-center text-sm font-medium transition-colors duration-200 ease-out motion-reduce:transition-none",
                                      isDone &&
                                        "text-muted-foreground line-through",
                                    )}
                                  >
                                    {item.title}
                                  </Label>
                                  <p
                                    className={cn(
                                      "mt-0.5 text-sm text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
                                      isDone && "text-muted-foreground/60",
                                    )}
                                  >
                                    {item.description}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs transition-opacity duration-200 ease-out motion-reduce:transition-none sm:mt-0 sm:w-64 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1",
                                    isDone && "opacity-60",
                                  )}
                                >
                                  <Badge
                                    variant="secondary"
                                    className="font-normal"
                                  >
                                    {item.type}
                                  </Badge>
                                  <span className="text-muted-foreground tabular-nums">
                                    {item.effort}
                                  </span>
                                  {item.resource ? (
                                    <span className="max-w-full text-pretty text-muted-foreground sm:text-right">
                                      {item.resource.provider} ·{" "}
                                      {item.resource.name}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </section>
    </div>
  );
}
