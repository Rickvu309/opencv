import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface FadingEdgeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function FadingEdge({ className, children, ...props }: FadingEdgeProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { FadingEdge, type FadingEdgeProps };
