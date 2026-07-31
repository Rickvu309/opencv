"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useStore } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const { state } = useStore();

  useEffect(() => {
    router.replace(state.onboarded ? "/home" : "/onboarding");
  }, [router, state.onboarded]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading OpenPath...</span>
    </div>
  );
}
