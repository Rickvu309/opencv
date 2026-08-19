import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../button";
import { cn } from "../../cn";
import { Input } from "../../input";
import "./beautiful.css";

export interface ApprovalQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

export interface ApprovalCardProps {
  questions?: ApprovalQuestion[];
  onDismiss?: () => void;
}

const DEFAULT_QUESTIONS: ApprovalQuestion[] = [
  {
    id: "count",
    prompt: "How many options should we launch?",
    choices: ["Three (core line)", "Five (full set)", "Just one lead"],
  },
  {
    id: "timing",
    prompt: "When should this go out?",
    choices: ["This week", "Next month", "Hold for review"],
  },
  {
    id: "scope",
    prompt: "Who should see the draft?",
    choices: ["Just you", "The working group", "Everyone on the thread"],
  },
];

export function ApprovalCard({ questions = DEFAULT_QUESTIONS, onDismiss }: ApprovalCardProps) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const [hidden, setHidden] = useState(false);
  const question = questions[step];
  if (!question || hidden) return null;

  const selected = picked[question.id];
  const canNext = Boolean(selected || custom.trim());

  function choose(choice: string) {
    setPicked((prev) => ({ ...prev, [question.id]: choice }));
    setCustom("");
  }

  function goNext() {
    if (step < questions.length - 1) {
      setStep((s) => s + 1);
      setCustom("");
    }
  }

  return (
    <div className="flex min-h-[12.25rem] w-full max-w-80 flex-col">
      <div className="overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-[510] text-ink">{question.prompt}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink"
              onClick={() => {
                setHidden(true);
                onDismiss?.();
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {question.choices.map((choice) => {
              const active = selected === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={active}
                  className="-mx-1.5 flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-left transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
                  onClick={() => choose(choice)}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_var(--hairline)]",
                      active && "shadow-[inset_0_0_0_1.5px_var(--accent)]",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full bg-accent transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]"
                      style={{ transform: active ? "scale(1)" : "scale(0.97)", opacity: active ? 1 : 0 }}
                    />
                  </span>
                  <span className={cn("text-[13px]", active ? "text-ink" : "text-ink-secondary")}>
                    {choice}
                  </span>
                </button>
              );
            })}
            <label className="-mx-1.5 flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 hover:bg-surface-2">
              <span aria-hidden="true" className="size-4 shrink-0" />
              <Input
                aria-label="Custom answer"
                placeholder="Type something…"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (e.target.value) {
                    setPicked((prev) => {
                      const next = { ...prev };
                      delete next[question.id];
                      return next;
                    });
                  }
                }}
                className="min-h-8 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:border-0"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous"
            disabled={step === 0}
            className="flex size-7 items-center justify-center rounded-[var(--radius-control)] text-ink-muted disabled:opacity-40"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          {questions.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to question ${i + 1}`}
              aria-current={i === step ? "true" : undefined}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-[var(--duration-fast)]",
                i === step ? "bg-ink" : "bg-hairline",
              )}
              onClick={() => setStep(i)}
            />
          ))}
          <button
            type="button"
            aria-label="Next"
            disabled={step === questions.length - 1}
            className="flex size-7 items-center justify-center rounded-[var(--radius-control)] text-ink-muted disabled:opacity-40"
            onClick={goNext}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <Button size="sm" disabled={!canNext} onClick={goNext}>
          {step === questions.length - 1 ? "Confirm" : "Next question"}
        </Button>
      </div>
    </div>
  );
}
