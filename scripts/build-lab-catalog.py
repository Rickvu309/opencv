#!/usr/bin/env python3
"""Build Lab Storybook catalog grouped by component / template, not by source kit."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import re

lab = Path("/Users/quanvu/NewOpenPath/packages/opath-ui/src/lab")
catalog = lab / "catalog"
catalog.mkdir(exist_ok=True)

FILES = {
    "Lab/Components/Actions": "components-actions.stories.tsx",
    "Lab/Components/Forms": "components-forms.stories.tsx",
    "Lab/Components/Overlays": "components-overlays.stories.tsx",
    "Lab/Components/Navigation": "components-navigation.stories.tsx",
    "Lab/Components/Data": "components-data.stories.tsx",
    "Lab/Components/Feedback": "components-feedback.stories.tsx",
    "Lab/Components/Motion": "components-motion.stories.tsx",
    "Lab/Components/Media": "components-media.stories.tsx",
    "Lab/Components/Chat": "components-chat.stories.tsx",
    "Lab/Templates/Auth": "templates-auth.stories.tsx",
    "Lab/Templates/Onboarding": "templates-onboarding.stories.tsx",
    "Lab/Templates/Dialogs": "templates-dialogs.stories.tsx",
    "Lab/Templates/Application": "templates-application.stories.tsx",
    "Lab/Templates/AI": "templates-ai.stories.tsx",
    "Lab/Templates/Marketing": "templates-marketing.stories.tsx",
}

BEUI = {
    "action-swap": "Actions",
    "expanding-arrow-button": "Actions",
    "button": "Actions",
    "input": "Forms",
    "select": "Forms",
    "combobox": "Forms",
    "checkbox": "Forms",
    "radio": "Forms",
    "range-slider": "Forms",
    "switch": "Forms",
    "wheel-picker": "Forms",
    "bottom-sheet": "Overlays",
    "drawer": "Overlays",
    "morphing-modal": "Overlays",
    "center-morph-modal": "Overlays",
    "popover": "Overlays",
    "tooltip": "Overlays",
    "context-menu": "Overlays",
    "tabs": "Navigation",
    "dock": "Navigation",
    "animated-sidebar": "Navigation",
    "bounce-sidebar": "Navigation",
    "preview-rail": "Navigation",
    "table": "Data",
    "animated-toast-stack": "Feedback",
    "animated-badge": "Feedback",
    "loader": "Feedback",
    "marquee": "Motion",
    "text-animation": "Motion",
    "number": "Motion",
    "shader-background": "Motion",
    "cylinder-carousel": "Motion",
    "shared-layout-bg": "Motion",
    "pull-to-refresh": "Motion",
    "tilt-card": "Motion",
    "bouncy-accordion": "Motion",
    "theme-toggle": "Motion",
}

BEAUTIFUL = {
    "Loading": ("Feedback", "LoadingState", "Loading", None, None),
    "Thinking": ("Chat", "Thinking", "Thinking", 480, None),
    "Streaming Text": ("Chat", "StreamingText", "Streaming Text", 520, None),
    "Approval Card": ("Chat", "ApprovalCard", "Approval Card", None, None),
    "Tool Chips": ("Chat", "ToolChips", "Tool Chips", None, None),
    "Task Rows": ("Chat", "TaskRows", "Task Rows", 520, None),
    "Chat": ("Chat", "Chat", "Chat", 480, None),
    "Prompt Bar": ("Chat", "PromptBar", "Prompt Bar", 480, None),
    "Recommendation Card": ("Chat", "RecommendationCard", "Recommendation Card", None, None),
    "Context Cards": ("Chat", "ContextCards", "Context Cards", None, None),
    "Diff Table": ("Data", "DiffTable", "Diff Table", 520, None),
    "Records Table": ("Data", "RecordsTable", "Records Table", 640, None),
    "Filter Table": ("Data", "FilterTable", "Filter Table", 520, None),
    "Sidebar Nav": ("Navigation", "SidebarNav", "Sidebar Nav", 280, 'className="bg-canvas p-3"'),
    "Search": ("Chat", "Search", "Search", None, None),
    "Flowchart": ("Chat", "Flowchart", "Flowchart", 520, 'className="p-3"'),
    "Insight Cards": ("Chat", "InsightCards", "Insight Cards", None, None),
    "Code Block": ("Chat", "CodeBlockBeautiful", "Code Block", 480, None),
    "Fine-tune Card": ("Chat", "FineTuneCard", "Fine-tune Card", None, None),
    "Selection Actions": ("Actions", "SelectionActions", "Selection Actions", 560, None),
}

BEAUTIFUL_IMPORTS = {
    "ApprovalCard": "./approval-card",
    "Chat": "./chat",
    "CodeBlockBeautiful": "./code-block",
    "ContextCards": "./context-cards",
    "DiffTable": "./diff-table",
    "FilterTable": "./filter-table",
    "FineTuneCard": "./fine-tune-card",
    "Flowchart": "./flowchart",
    "InsightCards": "./insight-cards",
    "LoadingState": "./loading-state",
    "PromptBar": "./prompt-bar",
    "RecommendationCard": "./recommendation-card",
    "RecordsTable": "./records-table",
    "Search": "./search",
    "SelectionActions": "./selection-actions",
    "SidebarNav": "./sidebar-nav",
    "StreamingText": "./streaming-text",
    "TaskRows": "./task-rows",
    "Thinking": "./thinking",
    "ToolChips": "./tool-chips",
}

KIBO_PREFIX = [
    ("collaborative-canvas", "Templates/Application"),
    ("dialog-stack", "Overlays"),
    ("contribution-graph", "Data"),
    ("feature-tabs", "Templates/Marketing"),
    ("case-studies", "Templates/Marketing"),
    ("case-study", "Templates/Marketing"),
    ("avatar-stack", "Data"),
    ("code-block", "Data"),
    ("code-example", "Data"),
    ("color-picker", "Forms"),
    ("credit-card", "Forms"),
    ("image-crop", "Forms"),
    ("image-zoom", "Media"),
    ("mini-calendar", "Forms"),
    ("relative-time", "Data"),
    ("theme-switcher", "Actions"),
    ("qr-code", "Data"),
    ("announcement", "Feedback"),
    ("choicebox", "Forms"),
    ("combobox", "Forms"),
    ("comparison", "Media"),
    ("dropzone", "Forms"),
    ("codebase", "Templates/Application"),
    ("calendar", "Forms"),
    ("changelog", "Templates/Marketing"),
    ("community", "Templates/Marketing"),
    ("compliance", "Templates/Marketing"),
    ("experience", "Templates/Marketing"),
    ("testimonial", "Templates/Marketing"),
    ("careers", "Templates/Marketing"),
    ("contact", "Templates/Marketing"),
    ("download", "Templates/Marketing"),
    ("pricing", "Templates/Marketing"),
    ("sandbox", "Templates/Application"),
    ("snippet", "Data"),
    ("spinner", "Feedback"),
    ("stories", "Media"),
    ("typography", "Data"),
    ("video-player", "Media"),
    ("roadmap", "Templates/Application"),
    ("compare", "Media"),
    ("banner", "Feedback"),
    ("editor", "Forms"),
    ("gantt", "Templates/Application"),
    ("glimpse", "Overlays"),
    ("kanban", "Templates/Application"),
    ("marquee", "Media"),
    ("rating", "Forms"),
    ("cursor", "Feedback"),
    ("footer", "Templates/Marketing"),
    ("ticker", "Data"),
    ("awards", "Templates/Marketing"),
    ("blogpost", "Templates/Marketing"),
    ("status", "Feedback"),
    ("about", "Templates/Marketing"),
    ("blog", "Templates/Marketing"),
    ("deck", "Media"),
    ("form", "Forms"),
    ("hero", "Templates/Marketing"),
    ("list", "Templates/Application"),
    ("pill", "Data"),
    ("reel", "Media"),
    ("tags", "Forms"),
    ("team", "Templates/Marketing"),
    ("tree", "Data"),
    ("stats", "Templates/Marketing"),
    ("cta", "Templates/Marketing"),
    ("faq", "Templates/Marketing"),
    ("table", "Data"),
    ("feature", "Templates/Marketing"),
]


def longest_prefix(slug: str, rules: list[tuple[str, str]]) -> str | None:
    matches = [cat for prefix, cat in rules if slug == prefix or slug.startswith(prefix + "-")]
    if not matches:
        return None
    # prefer the rule whose prefix is longest
    best = max(
        ((prefix, cat) for prefix, cat in rules if slug == prefix or slug.startswith(prefix + "-")),
        key=lambda item: len(item[0]),
    )
    return best[1]


def eightstar_category(slug: str) -> str:
    if slug.startswith("button"):
        return "Actions"
    if slug.startswith("open-in-chat"):
        return "Chat"
    if slug.startswith(("marquee", "video-player", "flip-clock")):
        return "Media"
    if slug.startswith(("status", "shake")):
        return "Feedback"
    return "Data"


def blocks_category(slug: str) -> str:
    if slug.startswith("login"):
        return "Templates/Auth"
    if slug.startswith("onboarding"):
        return "Templates/Onboarding"
    if slug.startswith("dialog"):
        return "Templates/Dialogs"
    if slug.startswith(("ai-", "command-menu")):
        return "Templates/AI"
    if slug.startswith("table"):
        return "Data"
    return "Templates/Application"


def title_for(kind: str) -> str:
    if kind.startswith("Templates/"):
        return f"Lab/{kind}"
    return f"Lab/Components/{kind}"


def pascal(slug: str) -> str:
    return "".join(part.title() for part in re.split(r"[-_]", slug) if part)


def humanize(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ")


entries: dict[str, list[dict]] = defaultdict(list)


def add(title: str, export: str, name: str, import_line: str, jsx: str, width, extra: str | None = None):
    entries[title].append(
        {
            "export": export,
            "name": name,
            "import": import_line,
            "jsx": jsx,
            "width": width,
            "extra": extra,
        }
    )


# --- beUI ---
for preview in sorted((lab / "beui" / "previews").glob("*.preview.tsx")):
    slug = preview.name.replace(".preview.tsx", "")
    src = preview.read_text()
    m = re.search(r"export function (\w+)", src)
    if not m:
        continue
    fn = m.group(1)
    kind = BEUI.get(slug, "Motion")
    add(
        title_for(kind),
        f"Beui{pascal(slug)}",
        humanize(slug),
        f'import {{ {fn} }} from "../beui/previews/{slug}.preview";',
        f"<{fn} />",
        560,
    )

# --- Transitions ---
for css in sorted((lab / "transitions").glob("*.css")):
    if css.name == "root.css":
        continue
    slug = css.stem
    name = pascal(slug)
    add(
        title_for("Motion"),
        f"Transition{name}",
        humanize(slug),
        f'import {{ {name} as {name}Demo }} from "../transitions/{slug}";',
        f"<{name}Demo />",
        480,
    )

# --- Beautiful ---
for display, (kind, ident, name, width, extra) in BEAUTIFUL.items():
    rel = BEAUTIFUL_IMPORTS[ident]
    add(
        title_for(kind),
        f"Beautiful{ident}",
        name,
        f'import {{ {ident} }} from "../beautiful/{rel.replace("./", "")}";',
        f"<{ident} />",
        width,
        extra,
    )

# --- 8StarLabs ---
examples = lab / "eightstar" / "examples"
for file in sorted(examples.glob("*.tsx")):
    slug = file.stem
    ident = pascal(slug)
    add(
        title_for(eightstar_category(slug)),
        f"Eightstar{ident}",
        humanize(slug.replace("-demo", "")),
        f'import {ident} from "../eightstar/examples/{slug}";',
        f"<{ident} />",
        640,
    )

# --- Blocks ---
blocks = lab / "blocks-so"
seen = set()
for folder in sorted(p for p in blocks.iterdir() if p.is_dir()):
    files = list(folder.glob("*.tsx"))
    if not files:
        continue
    main = folder / f"{folder.name}.tsx"
    file = main if main.exists() else files[0]
    # match existing blocks.stories.tsx special cases
    if folder.name == "sidebar-01":
        rel = f"./{folder.name}/index"
    elif folder.name == "sidebar-02":
        rel = f"./{folder.name}/index"
    elif folder.name == "sidebar-03":
        rel = f"./{folder.name}/index"
    elif folder.name == "sidebar-04":
        rel = f"./{folder.name}/nav-user"
    elif folder.name == "sidebar-05":
        rel = f"./{folder.name}/team-switcher"
    elif folder.name == "sidebar-06":
        rel = f"./{folder.name}/team-switcher"
    else:
        rel = f"./{folder.name}/{file.name.replace('.tsx', '')}"
    ident = pascal(folder.name)
    if ident in seen:
        continue
    seen.add(ident)
    add(
        title_for(blocks_category(folder.name)) if not folder.name.startswith("table") else title_for("Data"),
        f"Block{ident}",
        folder.name,
        f'import {ident} from "../blocks-so/{rel[2:]}";',
        f"<{ident} />",
        720,
    )

# --- Kibo examples ---
for file in sorted((lab / "kibo" / "_examples").glob("*.tsx")):
    if file.name.endswith(".stories.tsx"):
        continue
    slug = file.stem
    kind = longest_prefix(slug, KIBO_PREFIX)
    if kind is None:
        kind = "Data"
    ident = f"Example_{pascal(slug)}"
    add(
        title_for(kind) if not kind.startswith("Templates/") else f"Lab/{kind}",
        f"Kibo{pascal(slug)}",
        humanize(slug),
        f'import {ident} from "../kibo/_examples/{slug}";',
        f"<{ident} />",
        720,
    )

# Deduplicate export names per file
for title, items in entries.items():
    used = set()
    for item in items:
        base = item["export"]
        name = base
        i = 2
        while name in used:
            name = f"{base}{i}"
            i += 1
        used.add(name)
        item["export"] = name

for old in catalog.glob("*.stories.tsx"):
    old.unlink()

header = '''import type {{ Meta, StoryObj }} from "@storybook/react-vite";
import {{ StoryFrame }} from "../story-frame";
{imports}

const meta = {{ title: "{title}" }} satisfies Meta;
export default meta;
type Story = StoryObj;
'''

for title, filename in FILES.items():
    items = entries.get(title, [])
    if not items:
        continue
    imports = "\n".join(item["import"] for item in items)
    body = [header.format(imports=imports, title=title)]
    for item in items:
        attrs = []
        if item["width"]:
            attrs.append(f"width={{{item['width']}}}")
        if item["extra"]:
            attrs.append(item["extra"])
        attr_s = (" " + " ".join(attrs)) if attrs else ""
        body.append(
            f'''export const {item["export"]}: Story = {{
  name: "{item["name"]}",
  render: () => (
    <StoryFrame{attr_s}>
      {item["jsx"]}
    </StoryFrame>
  ),
}};
'''
        )
    (catalog / filename).write_text("\n".join(body))
    print(f"{title}: {len(items)}")

print("total", sum(len(v) for v in entries.values()))
unmapped = set(entries) - set(FILES)
if unmapped:
    print("UNMAPPED", unmapped)
