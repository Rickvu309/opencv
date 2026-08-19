import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

interface CopyButtonProps {
  value: string;
  className?: string;
}

function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("min-h-10 px-2", className)}
      aria-label={copied ? "Copied" : "Copy"}
      onClick={() => void copy()}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  );
}

export { CopyButton, type CopyButtonProps };
