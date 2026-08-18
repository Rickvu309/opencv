import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listPitchFn, draftBioFn, draftIntroFn } from "@/features/pitch/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Band } from "@/ui/band";
import { Section } from "@/ui/section";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";
import { useState } from "react";

export function PitchScreen() {
  const q = useQuery({ queryKey: ["pitch"], queryFn: () => listPitchFn() });
  const [introNote, setIntroNote] = useState("");
  const empty =
    q.data && !q.data.bio && !q.data.intro && q.data.answers.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Band title="Pitch" />
      {q.isPending ? <SkeletonSection /> : null}
      {q.isError ? <QueryError onRetry={() => void q.refetch()} /> : null}
      {q.data ? (
        empty ? (
          <EmptyState
            kind="first-run"
            title="Say who you are once, properly."
            action={
              <Button
                onClick={async () => {
                  const body = await draftBioFn();
                  await runCommand("pitch.saveBio", { body });
                  q.refetch();
                }}
              >
                Draft the bio from your profile
              </Button>
            }
          />
        ) : (
        <>
          <Section label="Bio">
            <div className="space-y-3">
            <Textarea defaultValue={q.data.bio?.body ?? ""} id="bio" />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void runCommand("pitch.saveBio", {
                    body: (document.getElementById("bio") as HTMLTextAreaElement).value,
                  }).then(() => q.refetch())
                }
              >
                Save bio
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const body = await draftBioFn();
                  await runCommand("pitch.saveBio", { body });
                  q.refetch();
                }}
              >
                Draft from profile
              </Button>
            </div>
            </div>
          </Section>
          <Section label="Intro">
            <div className="space-y-3">
            <Textarea defaultValue={q.data.intro?.body ?? ""} id="intro" />
            {introNote ? <p className="text-[13px] text-ink-muted">{introNote}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void runCommand("pitch.saveIntro", {
                    body: (document.getElementById("intro") as HTMLTextAreaElement).value,
                  }).then(() => q.refetch())
                }
              >
                Save intro
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const body = await draftIntroFn();
                  if (!body) {
                    setIntroNote("Set a goal on your profile first.");
                    return;
                  }
                  setIntroNote("");
                  await runCommand("pitch.saveIntro", { body });
                  q.refetch();
                }}
              >
                Draft intro
              </Button>
            </div>
            {introNote ? (
              <Link to="/profile" className="text-[13px] text-accent underline">
                Open Profile
              </Link>
            ) : null}
            </div>
          </Section>
          <Section label="Answers">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const prompt = (document.getElementById("answer-prompt") as HTMLInputElement).value;
                const body = (document.getElementById("answer-body") as HTMLTextAreaElement).value;
                void runCommand("pitch.addAnswer", { prompt, body }).then(() => q.refetch());
              }}
            >
              <input
                id="answer-prompt"
                className="min-h-11 w-full rounded-[var(--radius-control)] border border-hairline px-3"
                placeholder="The question"
                required
              />
              <Textarea id="answer-body" placeholder="Your answer, from work you actually did" />
              <Button type="submit">Save answer</Button>
            </form>
            {q.data.answers.map((a: { id: string; prompt: string; body: string }) => (
              <article key={a.id} className="mt-4">
                <p className="font-medium">{a.prompt}</p>
                <p className="text-ink-muted">{a.body}</p>
              </article>
            ))}
          </Section>
        </>
        )
      ) : null}
    </div>
  );
}
