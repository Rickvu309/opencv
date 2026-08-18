import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  const [mobile, setMobile] = useState(false);
  const toaster = useRef<HTMLElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    toaster.current?.setAttribute("role", "status");
  }, [mobile]);
  return (
    <Toaster
      ref={toaster}
      theme="light"
      position={mobile ? "bottom-center" : "bottom-right"}
      visibleToasts={3}
      richColors={false}
      customAriaLabel="Status"
      toastOptions={{
        unstyled: true,
        className:
          "flex items-center gap-3 rounded-[var(--radius-container)] border border-hairline bg-surface-1 px-4 py-3 text-[13px] leading-[1.5] text-ink shadow-[var(--shadow-overlay)]",
      }}
    />
  );
}
