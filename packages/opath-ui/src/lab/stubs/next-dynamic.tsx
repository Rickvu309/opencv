import { type ComponentType, lazy, Suspense } from "react";

export default function dynamic(
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
) {
  const Comp = lazy(loader);
  return function Dynamic(props: Record<string, unknown>) {
    return (
      <Suspense fallback={null}>
        <Comp {...props} />
      </Suspense>
    );
  };
}
