"use client";

import * as React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

/**
 * Navigation adapters so product code does not import a framework by name.
 *
 * `href` stays the public prop because that is how every screen already talks.
 * Underneath, TanStack Router owns the actual navigation.
 */

function partsOf(href: string) {
  const [path, query] = href.split("?");
  return {
    to: path as never,
    search: query
      ? (Object.fromEntries(new URLSearchParams(query)) as never)
      : undefined,
  };
}

export function Link({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { to, search } = partsOf(href);
  return (
    <RouterLink to={to} search={search} {...props}>
      {children}
    </RouterLink>
  );
}

export function useRouter() {
  const navigate = useNavigate();
  return React.useMemo(
    () => ({
      push: (href: string) => navigate(partsOf(href)),
      replace: (href: string, _opts?: { scroll?: boolean }) =>
        navigate({ ...partsOf(href), replace: true }),
    }),
    [navigate],
  );
}

export function usePathname(): string {
  return useRouterState({ select: (state) => state.location.pathname });
}
