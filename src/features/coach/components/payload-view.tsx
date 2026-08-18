import { Code } from "@/ui/code";

function PayloadView({ payload }: { payload: unknown }) {
  const raw =
    typeof payload === "string" ? payload : JSON.stringify(payload ?? {}, null, 2);
  return <Code value={raw}>{raw}</Code>;
}

export { PayloadView };
