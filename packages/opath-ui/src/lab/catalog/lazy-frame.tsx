import { Component, Suspense, type ReactNode } from "react";
import { StoryFrame } from "../story-frame";

class ChunkError extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="max-w-[640px] rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-6 text-[13px] text-ink">
          This preview could not load.
        </div>
      );
    }
    return this.props.children;
  }
}

export function LazyFrame({
  children,
  className,
  width,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  return (
    <ChunkError>
      <Suspense
        fallback={
          <div className="p-6 text-[13px] text-ink-secondary">Loading</div>
        }
      >
        <StoryFrame className={className} width={width}>
          {children}
        </StoryFrame>
      </Suspense>
    </ChunkError>
  );
}
