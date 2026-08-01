"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface OpenOpenPathButtonProps {
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  showIcon?: boolean;
  children?: React.ReactNode;
}

/**
 * The landing page's one primary CTA (Hick's Law: the same action, repeated
 * at every serial-position anchor, never a second competing action). Routes
 * to /home once onboarded, /onboarding otherwise, the exact check
 * app/page.tsx used to run itself before it became the public landing.
 */
export function OpenOpenPathButton({
  className,
  size = "lg",
  variant = "default",
  showIcon = true,
  children = "Open OpenPath",
}: OpenOpenPathButtonProps) {
  const { state } = useStore();
  const href = state.onboarded ? "/home" : "/onboarding";

  return (
    <Button asChild size={size} variant={variant} className={cn(className)}>
      <Link href={href}>
        {children}
        {showIcon ? <ArrowRight data-icon="inline-end" /> : null}
      </Link>
    </Button>
  );
}
