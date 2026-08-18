import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return (
    <Toaster
      position={mobile ? "bottom-center" : "bottom-right"}
      visibleToasts={3}
      toastOptions={{
        className:
          "border border-hairline bg-surface-1 text-[13px] text-ink shadow-[var(--shadow-overlay)]",
      }}
    />
  );
}
