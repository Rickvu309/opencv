import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";

export function CoachComposer({
  text,
  onText,
  onSend,
  disabled,
}: {
  text: string;
  onText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onSend();
      }}
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <Textarea
        id="composer"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!text.trim() || disabled) return;
            onSend();
          }
        }}
      />
      <Button className="mt-2" type="submit" disabled={disabled || !text.trim()}>
        Send
      </Button>
    </form>
  );
}
