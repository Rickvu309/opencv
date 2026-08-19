import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { Button } from "./button";

interface StickToBottomProps {
  children: ReactNode;
  className?: string;
}

function StickToBottom({ children, className }: StickToBottomProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [detached, setDetached] = useState(false);

  const stick = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setDetached(false);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || detached) return;
    el.scrollTop = el.scrollHeight;
  });

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={ref}
        className="h-full overflow-y-auto"
        onScroll={() => {
          const el = ref.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          setDetached(!atBottom);
        }}
      >
        {children}
      </div>
      {detached ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="pointer-events-auto min-h-10 shadow-[var(--shadow-overlay)]"
            onClick={stick}
          >
            Latest
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { StickToBottom, type StickToBottomProps };
