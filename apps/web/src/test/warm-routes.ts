await Promise.all([
  import("@/features/connections/index.ts"),
  import("@/routes/product-layout.tsx"),
  import("@/routes/paper.tsx"),
  import("@/routes/paper-doc.tsx"),
  import("@/routes/paper-lab.tsx"),
  import("@/routes/apply.tsx"),
  import("@/routes/apply-job.tsx"),
  import("@/routes/coming-soon.tsx"),
  import("@/routes/coach.tsx"),
  import("@/routes/inbox.tsx"),
  import("@/routes/settings.tsx"),
])
