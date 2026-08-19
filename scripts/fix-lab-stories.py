#!/usr/bin/env python3
"""Repair generated Lab galleries so Storybook can compile."""
from pathlib import Path
import re

lab = Path("/Users/quanvu/NewOpenPath/packages/opath-ui/src/lab")

# --- Kibo examples: @repo/foo -> relative ---
examples = lab / "kibo" / "_examples"
if examples.exists():
    for path in examples.rglob("*.tsx"):
        text = path.read_text()
        text = re.sub(r'@repo/shadcn-ui/components/ui/', '@/components/ui/', text)
        text = re.sub(r'@repo/shadcn-ui/lib/utils', '@/lib/utils', text)
        text = re.sub(r'@repo/([a-z0-9-]+)', r'../\1', text)
        path.write_text(text)
    print("rewrote kibo examples")

# --- beUI button preview ---
button_preview = lab / "beui" / "previews" / "button.preview.tsx"
if not button_preview.exists():
    button_preview.write_text(
        """import { Button, MagneticButton, StatefulButton } from "../motion/button";

export function ButtonPreview() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Press</Button>
      <MagneticButton>Magnetic</MagneticButton>
      <StatefulButton>Save</StatefulButton>
    </div>
  );
}
"""
    )
    print("wrote button preview")

# --- Transitions: interactive demos ---
css_files = sorted((lab / "transitions").glob("*.css"))
css_files = [p for p in css_files if p.name != "root.css"]

def pascal(slug: str) -> str:
    return "".join(part.title() for part in slug.replace("_", "-").split("-"))

for css in css_files:
    slug = css.stem
    name = pascal(slug)
    classes = re.findall(r"^\.([a-zA-Z][\w-]*)", css.read_text(), flags=re.M)
    main = next((c for c in classes if c.startswith("t-")), classes[0] if classes else "t-demo")
    (lab / "transitions" / f"{slug}.tsx").write_text(
        f"""import {{ useState }} from "react";
import "./root.css";
import "./{slug}.css";

export function {name}() {{
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="self-start rounded-[var(--radius-control)] border border-hairline bg-surface-1 px-3 py-2 text-[13px] font-[510] text-ink"
        onClick={{() => setOn((value) => !value)}}
      >
        {{on ? "Reset" : "Play"}}
      </button>
      <div
        className={{`{main} rounded-[var(--radius-container)] border border-hairline bg-surface-2 p-4 text-[13px] text-ink ${{on ? "is-on is-small is-open is-active" : ""}}`}}
        data-state={{on ? "open" : "closed"}}
      >
        {slug.replace("-", " ")}
      </div>
    </div>
  );
}}
"""
    )
print(f"transitions demos {len(css_files)}")

import subprocess
subprocess.check_call(["python3", str(Path("/Users/quanvu/NewOpenPath/scripts/build-lab-catalog.py"))])
