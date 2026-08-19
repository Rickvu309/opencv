import type { ReactNode } from "react";

export function Sandpack({ children }: { children?: ReactNode }) {
  return <div className="rounded-[var(--radius-container)] border border-hairline p-4 text-[13px] text-ink">{children}</div>;
}

export function SandpackProvider({ children }: { children?: ReactNode }) {
  return children;
}

export function SandpackPreview() {
  return null;
}

export function SandpackCodeEditor() {
  return null;
}

export function SandpackFileExplorer() {
  return null;
}

export function SandpackLayout({ children }: { children?: ReactNode }) {
  return children;
}

export function SandpackConsole() {
  return null;
}

export function SandpackStack({ children }: { children?: ReactNode }) {
  return children;
}
