export function useRouter() {
  return {
    push: (_href?: string) => undefined,
    replace: (_href?: string) => undefined,
    back: () => undefined,
    prefetch: (_href?: string) => undefined,
    refresh: () => undefined,
  };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
