import { toast } from "sonner";
import { dispatchFn, undoFn } from "@/core/commands/client";

export async function runCommand<T extends Record<string, unknown> = Record<string, unknown>>(
  name: string,
  input: unknown,
) {
  const result = await dispatchFn({
    data: { name, inputJson: JSON.stringify(input) },
  });
  toast("Saved", {
    action: {
      label: "Undo",
      onClick: () => {
        void undoFn({ data: { logId: result.id } }).then(() => toast("Undone"));
      },
    },
  });
  return {
    id: result.id,
    result: JSON.parse(result.resultJson || "{}") as T,
  };
}
