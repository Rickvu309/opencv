export function useTheme() {
  return {
    theme: "light",
    resolvedTheme: "light",
    setTheme: (_theme?: string) => undefined,
    themes: ["light"],
    systemTheme: "light",
  };
}

export function ThemeProvider({ children }: { children?: unknown }) {
  return children;
}
