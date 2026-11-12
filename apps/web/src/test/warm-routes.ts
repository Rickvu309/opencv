await Promise.all([
  import("@/features/connections/index.ts"),
  import("@/features/app-shell/app-shell-layout.tsx"),
  import("@/routes/paper.tsx"),
  import("@/routes/paper-doc.tsx"),
  import("@/features/paper/paper-cv-editor.tsx"),
  import("@/features/paper/paper-letter.tsx"),
  import("@/routes/paper-share.tsx"),
  import("@/routes/apply.tsx"),
  import("@/routes/apply-job.tsx"),
  import("@/routes/coach.tsx"),
  import("@/routes/inbox.tsx"),
  import("@/routes/settings.tsx"),
])
