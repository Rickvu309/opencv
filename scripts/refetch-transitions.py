#!/usr/bin/env python3
"""Re-fetch transitions.dev CSS (every fenced block) and wire Play demos."""
import re
import urllib.request
from pathlib import Path

lab = Path("/Users/quanvu/NewOpenPath/packages/opath-ui/src/lab/transitions")
base = "https://raw.githubusercontent.com/Jakubantalik/transitions.dev/main/skills/transitions-dev"

def pascal(slug: str) -> str:
    return "".join(part.title() for part in slug.split("-"))

skill = urllib.request.urlopen(f"{base}/SKILL.md").read().decode()
files = sorted(set(re.findall(r"\[(\d{2}-[a-z0-9-]+\.md)\]", skill)))

for file in files:
    slug = re.sub(r"^\d+-", "", file).removesuffix(".md")
    md = urllib.request.urlopen(f"{base}/{file}").read().decode()
    blocks = re.findall(r"```css\n(.*?)```", md, flags=re.S)
    css = "\n\n".join(blocks).strip() + "\n"
    (lab / f"{slug}.css").write_text(css)
    classes = re.findall(r"(?m)^\.([a-zA-Z][\w-]*)", css)
    main = next((c for c in classes if c.startswith("t-")), "t-demo")
    name = pascal(slug)
    (lab / f"{slug}.tsx").write_text(
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
        className={{`{main} h-24 w-full max-w-xs rounded-[var(--radius-container)] border border-hairline bg-surface-2 p-4 text-[13px] text-ink ${{on ? "is-on is-small is-open is-active is-expanded" : ""}}`}}
        data-state={{on ? "open" : "closed"}}
        data-open={{on}}
      >
        {slug.replace("-", " ")}
      </div>
    </div>
  );
}}
"""
    )
    print(slug, "class", main, "css", len(css))
print("done", len(files))
