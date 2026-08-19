import type { ReactNode } from "react";

export function Conversation({ children }: { children?: ReactNode }) {
  return <div className="flex min-h-80 flex-col">{children}</div>;
}

export function ConversationContent({ children }: { children?: ReactNode }) {
  return <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>;
}

export function ConversationScrollButton() {
  return null;
}

export function Message({ children }: { children?: ReactNode; from?: string }) {
  return <div className="text-[13px] text-ink">{children}</div>;
}

export function MessageContent({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

export function MessageResponse({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

export function PromptInput({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
  return <form className="border-t border-hairline p-3" {...props}>{children}</form>;
}

export function PromptInputButton({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
  return (
    <button type="button" className="text-[13px] text-ink" {...props}>
      {children}
    </button>
  );
}

export function PromptInputFooter({ children }: { children?: ReactNode }) {
  return <div className="mt-2 flex items-center gap-2">{children}</div>;
}

export function PromptInputSubmit({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
  return (
    <button type="submit" className="text-[13px] text-ink" {...props}>
      {children}
    </button>
  );
}

export function PromptInputTextarea(props: Record<string, unknown>) {
  return <textarea className="w-full bg-transparent text-[13px] text-ink" {...props} />;
}

export function PromptInputTools({ children }: { children?: ReactNode }) {
  return <div className="flex gap-1">{children}</div>;
}

export function PromptInputBody({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
