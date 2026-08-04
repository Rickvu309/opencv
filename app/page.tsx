import Link from "next/link";
import { ArrowRight, Compass, ListChecks, Route, UserSearch } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  { icon: UserSearch, label: "Hiểu bản thân" },
  { icon: Compass, label: "Cơ hội phù hợp" },
  { icon: ListChecks, label: "Lộ trình rõ ràng" },
];

export default function Home() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Route className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">OpenPath</span>
        </div>

        <h1 className="mt-10 text-4xl font-semibold tracking-display text-balance sm:text-5xl sm:leading-[1.15]">
          Hiểu bản thân. Chọn đúng hướng. Biết bắt đầu từ đâu.
        </h1>
        <p className="mt-5 max-w-md text-base text-muted-foreground text-pretty">
          AI Career Coach cá nhân hoá cho người trẻ Việt — đồng hành cùng bạn từ
          những bước đầu tiên của sự nghiệp.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-10 px-5">
            <Link href="/onboarding">
              Bắt đầu hành trình
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-10 px-5 text-muted-foreground">
            <Link href="/coach">Xem thử sản phẩm</Link>
          </Button>
        </div>

        <div className="mt-16 flex items-center gap-6 text-sm text-muted-foreground sm:gap-8">
          {features.map((feature) => (
            <span key={feature.label} className="flex items-center gap-2">
              <feature.icon className="size-4 text-primary" />
              {feature.label}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
