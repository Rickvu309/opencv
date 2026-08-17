"use client";

import * as React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

import { destinationOf } from "./nav-destination";

/**
 * Navigation adapters so product code does not import a framework by name.
 *
 * `href` stays the public prop because that is how every screen already talks.
 * Search is an object: omit it to parse `href`, pass it to skip parsing.
 * Underneath, TanStack Router owns the actual navigation.
 */

export { destinationOf };

export function Link({
  href,
  search,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  search?: object;
}) {
  const dest = destinationOf(href, search);
  return (
    <RouterLink to={dest.to} search={dest.search} {...props}>
      {children}
    </RouterLink>
  );
}

export function useRouter() {
  const navigate = useNavigate();
  return React.useMemo(
    () => ({
      push: (href: string) => navigate(destinationOf(href)),
      replace: (href: string, _opts?: { scroll?: boolean }) =>
        navigate({ ...destinationOf(href), replace: true }),
      to: (path: string, search?: object) =>
        navigate(destinationOf(path, search ?? {})),
      replaceTo: (path: string, search?: object, _opts?: { scroll?: boolean }) =>
        navigate({ ...destinationOf(path, search ?? {}), replace: true }),
    }),
    [navigate],
  );
}

export function usePathname(): string {
  return useRouterState({ select: (state) => state.location.pathname });
}
