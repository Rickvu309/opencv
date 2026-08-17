import { Link } from "@tanstack/react-router";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
    >
      Skip to content
    </a>
  );
}

export const nav = [
  { to: "/coach", label: "Coach" },
  { to: "/profile", label: "Profile" },
  { to: "/paper", label: "Paper" },
  { to: "/proof", label: "Proof" },
  { to: "/pitch", label: "Pitch" },
  { to: "/search", label: "Search" },
  { to: "/applications", label: "Applications" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppSidebar() {
  return (
    <aside className="border-r border-border p-4 md:w-52">
      <p className="mb-6 text-[18px] font-medium">OpenPath</p>
      <nav aria-label="App" className="flex flex-col gap-1">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-[var(--radius-control)] px-3 py-2 text-[14px] hover:bg-muted [&.active]:bg-muted [&.active]:text-accent"
            activeProps={{ className: "active" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
