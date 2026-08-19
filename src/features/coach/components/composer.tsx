import { useEffect, useRef, useState } from "react";
import { ArrowUp, Brain, Check, ChevronDown, MessageCircle, Mic, Phone, Plus, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { useCoachSession, type CoachPickerRole } from "@/features/coach/components/session";

const PROMPTS = [
  "Write to the Coach",
  "Start a CV",
  "What openings fit",
  "Draft a cover letter",
];

const MODES: { id: CoachPickerRole; label: string; hint: string; icon: typeof Zap }[] = [
  { id: "cheap", label: "Fast", hint: "Quick replies", icon: Zap },
  { id: "chat", label: "Coach", hint: "Default", icon: MessageCircle },
  { id: "drafting", label: "Careful", hint: "Takes more time on writing", icon: Brain },
];

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CoachComposer({
  text,
  onText,
  onSend,
  onStop,
  disabled,
  working,
  queued,
}: {
  text: string;
  onText: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  working?: boolean;
  queued?: string | null;
}) {
  const { coachRole, setCoachRole } = useCoachSession();
  const ref = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const [listening, setListening] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const idle = !text.trim() || disabled || (working && !onStop);
  const empty = !text.trim();
  const mode = MODES.find((m) => m.id === coachRole) ?? MODES[1]!;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 192)}px`;
  }, [text]);

  useEffect(() => {
    return () => recRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!empty) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setPromptIndex((i) => (i + 1) % PROMPTS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [empty]);

  function toggleDictation() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast("Dictation needs a browser that supports speech input.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken) onText(text ? `${text.trim()} ${spoken}` : spoken);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div>
      {queued ? (
        <p className="mb-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">
          Sends when the Coach finishes. {queued}
        </p>
      ) : null}
      {working ? (
        <p className="mb-2 text-[13px] text-ink-muted">Stop to send something else.</p>
      ) : null}
      <form
        className="flex min-h-12 items-center rounded-full border border-hairline bg-surface-1 py-1.5 pl-3 pr-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.08)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (working && onStop) {
            onStop();
            return;
          }
          if (idle) return;
          onSend();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              aria-label="More"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <Plus className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onSelect={() => onText("Start a CV")}>Start a CV</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onText("Log something as Proof")}>
                Log Proof
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <div className="relative flex min-h-8 min-w-0 flex-1 items-center">
            <textarea
              ref={ref}
              id="composer"
              rows={1}
              value={text}
              disabled={disabled}
              placeholder=""
              className="relative z-10 block min-h-8 w-full resize-none bg-transparent py-1 text-[15px] leading-6 text-ink outline-none focus-visible:!shadow-none"
              onChange={(e) => onText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (working && onStop) {
                    onStop();
                    return;
                  }
                  if (idle) return;
                  onSend();
                }
              }}
            />
            {empty ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[15px] leading-6 text-ink-muted"
              >
                <span key={promptIndex} className="prompt-roll block">
                  {PROMPTS[promptIndex]}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              aria-label="Coach speed"
              className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-[510] text-ink hover:bg-surface-2"
            >
              {mode.label}
              <ChevronDown className="size-3 text-ink-muted" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="min-w-52">
              {MODES.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onSelect={() => setCoachRole(m.id)}
                  className="gap-2"
                >
                  <m.icon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{m.label}</span>
                    <span className="block text-[12px] font-normal text-ink-muted">{m.hint}</span>
                  </span>
                  {coachRole === m.id ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            aria-label={listening ? "Stop dictation" : "Dictation"}
            aria-pressed={listening}
            onClick={toggleDictation}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-[background-color,color] duration-[var(--duration-fast)]",
              listening
                ? "bg-accent-muted text-ink"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Mic className="size-4" aria-hidden="true" />
          </button>

          {working || !idle ? (
            <button
              type="submit"
              aria-label={working ? "Stop" : "Send"}
              className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover enabled:active:scale-[0.97]"
            >
              {working ? (
                <Square className="size-3 fill-current" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Call"
              onClick={() => toast("Call mode is not available yet.")}
              className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover"
            >
              <Phone className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
