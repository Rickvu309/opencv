await Promise.all([
  import("@/features/app-shell/app-shell-layout.tsx"),
  import("@/routes/paper.tsx"),
  import("@/routes/paper-doc.tsx"),
  import("@/routes/paper-share.tsx"),
  import("@/routes/apply.tsx"),
  import("@/routes/apply-job.tsx"),
  import("@/routes/coming-soon.tsx"),
  import("@/routes/coach.tsx"),
  import("@/routes/inbox.tsx"),
  import("@/routes/settings.tsx"),
])
