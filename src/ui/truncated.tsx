import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TruncatedProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  titleText?: string;
}

function Truncated({ children, titleText, className, ...props }: TruncatedProps) {
  const title =
    titleText ?? (typeof children === "string" ? children : undefined);
  return (
    <span className={cn("block truncate", className)} title={title} {...props}>
      {children}
    </span>
  );
}

export { Truncated, type TruncatedProps };
