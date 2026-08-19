import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface EmptyMessageCardProps {
  title: string;
  action?: ReactNode;
}

function EmptyMessageCard({ title, action }: EmptyMessageCardProps) {
  return (
    <Card>
      <p className="text-[15px] leading-[1.6]">{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

function EndOfList({ label = "That's all." }: { label?: string }) {
  return (
    <p className="py-3 text-center text-[12px] leading-[1.5] text-ink-faint">{label}</p>
  );
}

export { Card, EmptyMessageCard, EndOfList, type CardProps, type EmptyMessageCardProps };
