"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDispatch } from "@/lib/actions/store";
import { paragraphsOf, type ProseDocument } from "@/lib/papers/types";
import { useT } from "@/lib/i18n/use-t";

/**
 * The letter itself: one box per paragraph.
 *
 * ## Why not one textarea for the whole thing
 *
 * It would be less code and it would be wrong. The Coach edits this document
 * too, through `paper.updateParagraph`, and a single box holding the whole body
 * has to write the whole body back. So a Coach edit that lands while the user
 * is mid-sentence would be overwritten by that user's next blur, silently, and
 * the user would watch a paragraph they had just been given disappear.
 *
 * One box per paragraph makes the unit the user edits the same as the unit the
 * Coach edits, which is the only arrangement where the two cannot clobber each
 * other. It is also what makes "rewrite paragraph 2" a thing the user can see
 * happen.
 */
export function ParagraphEditor({ paper }: { paper: ProseDocument }) {
  const paragraphs = paragraphsOf(paper.body);
  const { t, m } = useT();
  const dispatch = useDispatch();

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <Paragraph
          // The index, not the text: a key made from the content remounts the
          // box on every keystroke and the caret jumps to the end.
          key={index}
          paper={paper}
          index={index + 1}
          text={paragraph}
          count={paragraphs.length}
        />
      ))}

      {paragraphs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t(m.papers.emptyDocument)}</p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() =>
          dispatch("paper.addParagraph", { id: paper.id, text: "…" }, { silent: true })
        }
      >
        <Plus className="size-3.5" />
        {t(m.papers.addParagraph)}
      </Button>
    </div>
  );
}

function Paragraph({
  paper,
  index,
  text,
  count,
}: {
  paper: ProseDocument;
  index: number;
  text: string;
  count: number;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const [draft, setDraft] = React.useState(text);

  // The stored text wins when it changes underneath us, which is what a Coach
  // edit looks like from here. Compared against the last value this box was
  // given rather than against the draft, so somebody typing is not interrupted
  // by their own keystrokes echoing back.
  const [given, setGiven] = React.useState(text);
  if (text !== given) {
    setGiven(text);
    setDraft(text);
  }

  const commit = () => {
    const next = draft.trim();
    if (next === text) return;
    if (next.length === 0) {
      // An emptied box is a deletion, and deletions ask first everywhere else
      // in this app. Put the text back and let the delete button do it.
      setDraft(text);
      return;
    }
    dispatch("paper.updateParagraph", { id: paper.id, index, text: next }, { silent: true });
  };

  return (
    <div className="group/paragraph rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t(m.papers.paragraph(index))}
        </span>
        {/* Controls stay hidden until the paragraph is hovered or focused
            within, so a page of six paragraphs is not a page of eighteen
            buttons. They are always reachable by keyboard. */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-[var(--duration-press)] group-hover/paragraph:opacity-100 group-focus-within/paragraph:opacity-100 motion-reduce:transition-none">
          <IconAction
            label={t(m.papers.moveUp)}
            disabled={index === 1}
            onClick={() =>
              dispatch("paper.moveParagraph", { id: paper.id, index, by: -1 }, { silent: true })
            }
          >
            <ArrowUp className="size-3.5" />
          </IconAction>
          <IconAction
            label={t(m.papers.moveDown)}
            disabled={index === count}
            onClick={() =>
              dispatch("paper.moveParagraph", { id: paper.id, index, by: 1 }, { silent: true })
            }
          >
            <ArrowDown className="size-3.5" />
          </IconAction>
          <IconAction
            label={t(m.papers.removeParagraph)}
            onClick={() => dispatch("paper.removeParagraph", { id: paper.id, index })}
          >
            <Trash2 className="size-3.5" />
          </IconAction>
        </div>
      </div>

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder={t(m.papers.paragraphPlaceholder)}
        aria-label={t(m.papers.paragraph(index))}
        // Grows with the text rather than scrolling inside itself: a paragraph
        // you cannot see the end of is one you cannot edit with any confidence.
        rows={Math.max(3, Math.ceil(draft.length / 70) + draft.split("\n").length)}
        className="mt-1.5 resize-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="text-muted-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
