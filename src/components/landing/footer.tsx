import { Link } from "@/lib/nav";

export function LandingFooter() {
  return (
    <footer className="mt-auto pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        OpenPath
      </Link>
    </footer>
  );
}
