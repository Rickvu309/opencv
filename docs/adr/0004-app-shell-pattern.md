# Grok-style app shell, Home-as-Coach, no Projects

OpenPath's primary UI shape is a Grok-style shell: a collapsible left sidebar (Home, Search, Paper, Apply, Pitch, History of Threads, profile → Settings) and a single main pane the active surface fills. Home is the Coach — idle greeting + composer that becomes a chat Thread. This settles the "chat-first vs mixed" question ADR-0001 deferred: mixed, with conversation as the default landing surface and craft surfaces one click away.

**Validated by prototype.** Five shell variants (P1–P5) plus earlier Option A layouts were explored on `prototype/app-shell` (frozen 2026-08-24). P1 (`GrokStyleShell`) won. The branch is the visual and interaction reference for production; reference modules are indexed in `docs/specs/spec-3-app-shell.md`.

**No Projects.** Grok-style Projects (sidebar project list, scoped instructions/files) were prototyped and removed after review. The shell has no project middle panel; do not reintroduce one without superseding this ADR. CV "project" sections are a Paper concern.

**Surfaces are stable.** `SurfaceId = home | paper | apply | pitch | settings`. New top-level surfaces are a deliberate ADR-level change, not a nav tweak.

**Craft surfaces swap in place.** Paper, Apply, Pitch, and Settings render in the main pane under stable URLs; later specs replace stub content in place without re-litigating layout. A craft surface may host a dismissible floating Coach overlay; the single-main-pane rule is otherwise intact.

**Out of scope here:** auth and route protection, notification inbox placement, mobile-native layout.

Supersede when the primary UI shape changes on purpose.
