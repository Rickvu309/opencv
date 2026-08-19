import { useState } from "react";
import "./root.css";
import "./error-state-shake.css";

export function ErrorStateShake() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="self-start rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 py-2 text-[13px] font-[510] text-ink"
        onClick={() => setOn((value) => !value)}
      >
        {on ? "Reset" : "Play"}
      </button>
      <div
        className={`t-input h-24 w-full max-w-xs rounded-[var(--radius-container)] border border-hairline bg-surface-2 p-4 text-[13px] text-ink ${on ? "is-on is-small is-open is-active is-expanded" : ""}`}
        data-state={on ? "open" : "closed"}
        data-open={on}
      >
        error state shake
      </div>
    </div>
  );
}
