import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";

interface LoaderProps {
  className?: string;
  label?: string;
}

function Loader({ className, label = "Loading" }: LoaderProps) {
  return (
    <span className={cn("inline-flex items-center", className)} role="status" aria-label={label}>
      <LoaderCircle className="size-4 animate-spin text-ink-muted" aria-hidden="true" />
    </span>
  );
}

export { Loader, type LoaderProps };
