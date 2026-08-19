import { useState } from "react";
import "./root.css";
import "./input-clear-dissolve.css";

export function InputClearDissolve() {
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
        className={`t-clear h-24 w-full max-w-xs rounded-[var(--radius-container)] border border-hairline bg-surface-2 p-4 text-[13px] text-ink ${on ? "is-on is-small is-open is-active is-expanded" : ""}`}
        data-state={on ? "open" : "closed"}
        data-open={on}
      >
        input clear dissolve
      </div>
    </div>
  );
}
