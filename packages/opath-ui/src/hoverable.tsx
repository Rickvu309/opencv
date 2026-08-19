import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface HoverableRootProps extends HTMLAttributes<HTMLDivElement> {
  group?: string;
  children: ReactNode;
}

function HoverableRoot({ group = "row", className, children, ...props }: HoverableRootProps) {
  return (
    <div data-hover-group={group} className={cn("relative", className)} {...props}>
      {children}
    </div>
  );
}

interface HoverableItemProps extends HTMLAttributes<HTMLDivElement> {
  group?: string;
  children: ReactNode;
}

function HoverableItem({ group = "row", className, children, ...props }: HoverableItemProps) {
  return (
    <div data-hover-item={group} className={cn("shrink-0", className)} {...props}>
      {children}
    </div>
  );
}

const Hoverable = { Root: HoverableRoot, Item: HoverableItem };

export { Hoverable, HoverableRoot, HoverableItem };
