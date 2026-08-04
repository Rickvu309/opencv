"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronLeft,
  FileText,
  GraduationCap,
  Loader2,
  Route,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { user } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const steps = [
  {
    label: "Cá nhân",
    headline: "Bạn là ai?",
    support: "Vài thông tin cơ bản để OpenPath xưng hô và đồng hành đúng cách với bạn.",
    next: "Tiếp tục · Học vấn",
  },
  {
    label: "Học vấn",
    headline: "Bạn đang học ở đâu?",
    support: "Nền tảng học tập giúp AI nhìn đúng điểm xuất phát, thay vì đoán mò.",
    next: "Tiếp tục · Hồ sơ & CV",
  },
  {
    label: "Hồ sơ & CV",
    headline: "Cho mình xem hồ sơ của bạn",
    support: "Tải CV lên, AI sẽ đọc và điền phần còn lại giúp bạn — nhanh hơn gõ tay rất nhiều.",
    next: "Tiếp tục · Mục tiêu",
  },
  {
    label: "Mục tiêu",
    headline: "Bạn muốn đi về đâu?",
    support: "Chưa rõ cũng không sao — nói ra được điều bạn đang nghĩ là đã đủ để bắt đầu.",
    next: "Hoàn tất & xem phân tích",
  },
];

const roleSuggestions = [
  { value: "Data Analyst", note: "Làm việc với số liệu, dashboard và báo cáo" },
  { value: "Business Analyst", note: "Cầu nối giữa nghiệp vụ và đội sản phẩm" },
  { value: "Product", note: "Định hình sản phẩm từ nhu cầu người dùng" },
  { value: "Marketing", note: "Tăng trưởng, nội dung và hiệu quả kênh" },
];

const certaintyOptions = [
  { value: "Rất rõ", note: "Mình đã tìm hiểu kỹ và muốn theo đuổi hướng này." },
  { value: "Tương đối", note: "Mình nghiêng về hướng này nhưng vẫn muốn so sánh thêm." },
  { value: "Chưa rõ", note: "Mình vẫn đang phân vân giữa nhiều lựa chọn." },
];

const extractedSkills = [
  "SQL cơ bản",
  "Excel & Looker Studio",
  "Phân tích số liệu chiến dịch",
  "Quản lý nhóm",
];

const fieldClass = "h-10 text-sm";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);

  // Step 1 — Personal details
  const [name, setName] = React.useState(user.name);
  const [gender, setGender] = React.useState(user.gender);
  const [birthYear, setBirthYear] = React.useState(String(user.birthYear));

  // Step 2 — Education
  const [school, setSchool] = React.useState(user.school);
  const [major, setMajor] = React.useState(user.major);
  const [year, setYear] = React.useState(user.year);
  const [gpa, setGpa] = React.useState("");
  const [courses, setCourses] = React.useState("");

  // Step 3 — CV & LinkedIn
  const [linkedin, setLinkedin] = React.useState("");
  const [cvFileName, setCvFileName] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [autoFilled, setAutoFilled] = React.useState(false);

  // Step 4 — Goal
  const [targetRole, setTargetRole] = React.useState(user.targetRole);
  const [certainty, setCertainty] = React.useState("Tương đối");

  // Done
  const [finishing, setFinishing] = React.useState(false);

  function handleAutoFill() {
    if (analyzing) return;
    if (!cvFileName) setCvFileName("TranMinhAnh_CV.pdf");
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setAutoFilled(true);
      setGpa(user.gpa);
      setCourses(user.courses.join("\n"));
      setLinkedin((v) => v || "linkedin.com/in/minhanh-tran");
      toast.success("Đã điền tự động từ CV của bạn", {
        description: "Bạn có thể quay lại các bước trước để kiểm tra và chỉnh sửa.",
      });
    }, 1500);
  }

  function handleFinish() {
    setFinishing(true);
    setTimeout(() => router.push("/profile"), 1800);
  }

  const current = steps[step];
  const headline = finishing ? "Cảm ơn bạn đã chia sẻ" : current.headline;
  const support = finishing
    ? "Ngồi yên một chút — OpenPath đang đọc lại toàn bộ hồ sơ để dựng lộ trình riêng cho bạn."
    : current.support;

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      {/* ————— Left pane: context ————— */}
      <aside className="flex shrink-0 flex-col gap-5 bg-foreground px-5 py-5 text-background sm:px-8 lg:h-full lg:w-1/2 lg:gap-0 lg:px-12 lg:py-10 xl:px-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-background/40"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-background text-foreground">
                <Route className="size-4" />
              </span>
              <span className="text-base font-semibold tracking-tight">OpenPath</span>
            </Link>
            <span className="text-[11px] tracking-wide text-background/50 uppercase tabular-nums lg:hidden">
              Bước {step + 1}/{steps.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300 ease-out motion-reduce:transition-none",
                  i <= step || finishing ? "bg-background" : "bg-background/25"
                )}
              />
            ))}
          </div>

          <div className="hidden grid-cols-4 gap-2 lg:grid">
            {steps.map((s, i) => (
              <span
                key={s.label}
                className={cn(
                  "text-[11px] tracking-wide uppercase transition-opacity duration-300 motion-reduce:transition-none",
                  i === step && !finishing ? "opacity-100" : "opacity-50"
                )}
              >
                {s.label}
              </span>
            ))}
          </div>

          <p className="text-[11px] font-medium tracking-wide uppercase lg:hidden">
            {current.label}
          </p>
        </div>

        <div className="hidden flex-1 flex-col justify-center lg:flex">
          <div
            key={headline}
            className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
          >
            <h1 className="max-w-lg text-4xl font-semibold tracking-display text-balance lg:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-background/70">{support}</p>
          </div>
        </div>

        <p className="hidden text-xs text-background/45 lg:block">
          Thông tin chỉ dùng để cá nhân hoá lời khuyên — bạn có thể chỉnh sửa bất cứ lúc nào.
        </p>
      </aside>

      {/* ————— Right pane: the form ————— */}
      <section className="flex flex-1 flex-col bg-background lg:h-full lg:w-1/2 lg:overflow-y-auto">
        <div className="flex min-h-full flex-1 flex-col px-5 py-8 sm:px-8 lg:justify-center lg:px-12 lg:py-14 xl:px-16">
          <div
            key={finishing ? "finishing" : step}
            className="mx-auto w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
          >
            <div className="mb-7 lg:hidden">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">{headline}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{support}</p>
            </div>

            {finishing ? (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2.5 text-sm font-medium">
                  <Loader2 className="size-4 animate-spin" />
                  AI đang phân tích hồ sơ…
                </div>
                <div className="grid gap-3">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Đang đối chiếu hồ sơ của bạn với các hướng nghề phù hợp…
                </p>
              </div>
            ) : (
              <>
                {step === 0 && (
                  <div className="grid gap-6">
                    <Field htmlFor="name" label="Họ và tên">
                      <Input
                        id="name"
                        className={fieldClass}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field htmlFor="gender" label="Giới tính">
                        <Select value={gender} onValueChange={setGender}>
                          <SelectTrigger id="gender" className={cn(fieldClass, "w-full")}>
                            <SelectValue placeholder="Chọn giới tính" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Nữ">Nữ</SelectItem>
                            <SelectItem value="Nam">Nam</SelectItem>
                            <SelectItem value="Khác">Khác</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field htmlFor="birth-year" label="Năm sinh">
                        <Input
                          id="birth-year"
                          inputMode="numeric"
                          className={cn(fieldClass, "tabular-nums")}
                          value={birthYear}
                          onChange={(e) => setBirthYear(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-6">
                    <Field htmlFor="school" label="Trường đại học">
                      <Input
                        id="school"
                        className={fieldClass}
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="major" label="Chuyên ngành">
                      <Input
                        id="major"
                        className={fieldClass}
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field htmlFor="year" label="Năm học">
                        <Select value={year} onValueChange={setYear}>
                          <SelectTrigger id="year" className={cn(fieldClass, "w-full")}>
                            <SelectValue placeholder="Chọn năm học" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Năm 1">Năm 1</SelectItem>
                            <SelectItem value="Năm 2">Năm 2</SelectItem>
                            <SelectItem value="Năm 3">Năm 3</SelectItem>
                            <SelectItem value="Năm 4">Năm 4</SelectItem>
                            <SelectItem value="Đã tốt nghiệp">Đã tốt nghiệp</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field htmlFor="gpa" label="GPA" hint="không bắt buộc">
                        <Input
                          id="gpa"
                          placeholder="Ví dụ: 3.4/4.0"
                          className={fieldClass}
                          value={gpa}
                          onChange={(e) => setGpa(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field htmlFor="courses" label="Các khoá học bổ trợ">
                      <Textarea
                        id="courses"
                        rows={3}
                        className="text-sm"
                        placeholder={
                          "Mỗi khoá một dòng, ví dụ:\nGoogle Data Analytics (Coursera)\nIELTS 6.5"
                        }
                        value={courses}
                        onChange={(e) => setCourses(e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-6">
                    <Field htmlFor="linkedin" label="LinkedIn URL" hint="không bắt buộc">
                      <Input
                        id="linkedin"
                        placeholder="linkedin.com/in/ten-cua-ban"
                        className={fieldClass}
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                      />
                    </Field>

                    <div className="grid gap-2">
                      <Label>CV của bạn</Label>
                      <button
                        type="button"
                        onClick={() => setCvFileName("TranMinhAnh_CV.pdf")}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-sm outline-none transition-colors motion-reduce:transition-none",
                          "hover:border-foreground/40 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                          cvFileName ? "border-foreground/40 bg-muted" : "border-border"
                        )}
                      >
                        {cvFileName ? (
                          <>
                            <FileText className="size-5" />
                            <span className="font-medium">{cvFileName}</span>
                            <span className="text-xs text-muted-foreground">
                              Nhấn để chọn tệp khác
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="size-5 text-muted-foreground" />
                            <span className="font-medium">Kéo thả hoặc nhấn để tải CV lên</span>
                            <span className="text-xs text-muted-foreground">
                              PDF hoặc DOCX, tối đa 5MB
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {analyzing ? (
                      <div className="rounded-xl border bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Loader2 className="size-4 animate-spin" />
                          AI đang đọc CV của bạn…
                        </div>
                        <div className="mt-3 grid gap-2">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-3.5 w-2/3" />
                        </div>
                      </div>
                    ) : autoFilled ? (
                      <div className="rounded-xl border bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Check className="size-4 text-success" />
                          Đã trích xuất từ CV và điền vào hồ sơ của bạn
                        </div>
                        <Separator className="my-3" />
                        <dl className="grid gap-3 text-sm">
                          <div className="flex gap-2.5">
                            <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div>
                              <dt className="font-medium">Học vấn</dt>
                              <dd className="text-muted-foreground">
                                {user.school} — {user.major}, {user.year} · GPA {user.gpa}
                              </dd>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div>
                              <dt className="font-medium">Kinh nghiệm</dt>
                              <dd className="text-muted-foreground">
                                {user.experience
                                  .map((e) => `${e.title} · ${e.org} (${e.period})`)
                                  .join(" — ")}
                              </dd>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div>
                              <dt className="font-medium">Kỹ năng</dt>
                              <dd className="text-muted-foreground">
                                {extractedSkills.join(" · ")}
                              </dd>
                            </div>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 justify-self-start rounded-lg px-3.5"
                        onClick={handleAutoFill}
                      >
                        <Sparkles data-icon="inline-start" />
                        Điền tự động từ CV
                      </Button>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-6">
                    <Field htmlFor="target-role" label="Công việc / định hướng mong muốn">
                      <Input
                        id="target-role"
                        placeholder="Ví dụ: Data Analyst"
                        className={fieldClass}
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                      />
                      <div className="mt-3 -space-y-px">
                        {roleSuggestions.map((role) => {
                          const selected = targetRole === role.value;
                          return (
                            <button
                              key={role.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setTargetRole(role.value)}
                              className={cn(
                                "relative flex w-full items-center justify-between gap-3 border px-4 py-3 text-left outline-none transition-colors first:rounded-t-xl last:rounded-b-xl focus-visible:z-20 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                                selected
                                  ? "z-10 border-foreground bg-muted"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              <span className="grid gap-0.5">
                                <span className="text-sm font-medium">{role.value}</span>
                                <span className="text-xs text-muted-foreground">{role.note}</span>
                              </span>
                              {selected ? <Check className="size-4 shrink-0" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <div className="grid gap-2">
                      <Label>Bạn chắc chắn về định hướng này đến mức nào?</Label>
                      <RadioGroup
                        value={certainty}
                        onValueChange={setCertainty}
                        className="mt-1 grid gap-0 -space-y-px"
                      >
                        {certaintyOptions.map((option) => {
                          const selected = certainty === option.value;
                          return (
                            <Label
                              key={option.value}
                              htmlFor={`certainty-${option.value}`}
                              className={cn(
                                "relative flex cursor-pointer items-start gap-3 border px-4 py-3 font-normal transition-colors first:rounded-t-xl last:rounded-b-xl has-focus-visible:z-20 motion-reduce:transition-none",
                                selected
                                  ? "z-10 border-foreground bg-muted"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              <RadioGroupItem
                                id={`certainty-${option.value}`}
                                value={option.value}
                                className="mt-0.5"
                              />
                              <span className="grid gap-0.5">
                                <span className="text-sm font-medium">{option.value}</span>
                                <span className="text-xs text-muted-foreground">{option.note}</span>
                              </span>
                            </Label>
                          );
                        })}
                      </RadioGroup>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Chưa rõ cũng không sao — OpenPath sẽ giúp bạn khám phá và chọn hướng phù hợp
                        nhất.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Navigation bar */}
        <div className="sticky bottom-0 border-t bg-background/85 px-5 py-4 backdrop-blur-sm sm:px-8 lg:px-12 lg:py-5 xl:px-16">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Quay lại bước trước"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0 || finishing}
              className="size-10 shrink-0 rounded-full"
            >
              <ChevronLeft />
            </Button>
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              Bước {step + 1} / {steps.length}
            </span>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                className="ml-auto h-10 rounded-full px-5"
              >
                {current.next}
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={finishing}
                className="ml-auto h-10 rounded-full px-5"
              >
                {finishing ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    Đang xử lý…
                  </>
                ) : (
                  <>
                    {current.next}
                    <ArrowRight data-icon="inline-end" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      <Toaster position="top-right" />
    </div>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {hint ? <span className="font-normal text-muted-foreground">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}
