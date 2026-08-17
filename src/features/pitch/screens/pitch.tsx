import { useQuery } from "@tanstack/react-query";
import { listPitchFn, draftBioFn, draftIntroFn } from "@/features/pitch/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { EmptyState } from "@/ui/empty-state";
import { meFn } from "@/features/auth/server";

export function PitchScreen() {
  const q = useQuery({ queryKey: ["pitch"], queryFn: () => listPitchFn() });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  if (!q.data) return <p>Loading pitch.</p>;
  const empty = !q.data.bio && !q.data.intro && q.data.answers.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] font-medium">Pitch</h1>
      {empty ? <EmptyState title="Say who you are once, properly." /> : null}
      <section className="mt-8">
        <h2 className="text-[18px] font-medium">Bio</h2>
        <Textarea defaultValue={q.data.bio?.body ?? ""} id="bio" />
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (!me.data) return;
              const body = await draftBioFn();
              await runCommand("pitch.saveBio", { body });
              q.refetch();
            }}
          >
            Draft from profile
          </Button>
          <Button
            onClick={() =>
              void runCommand("pitch.saveBio", {
                body: (document.getElementById("bio") as HTMLTextAreaElement).value,
              }).then(() => q.refetch())
            }
          >
            Save
          </Button>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-[18px] font-medium">Intro</h2>
        <Textarea defaultValue={q.data.intro?.body ?? ""} id="intro" />
        <Button
          className="mt-2"
          variant="outline"
          onClick={async () => {
            if (!me.data) return;
            const body = await draftIntroFn();
            if (!body) {
              window.alert("Set a goal on your profile first.");
              return;
            }
            await runCommand("pitch.saveIntro", { body });
            q.refetch();
          }}
        >
          Draft intro
        </Button>
      </section>
      <section className="mt-8">
        <h2 className="text-[18px] font-medium">Answers</h2>
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const prompt = (document.getElementById("answer-prompt") as HTMLInputElement).value;
            const body = (document.getElementById("answer-body") as HTMLTextAreaElement).value;
            void runCommand("pitch.addAnswer", { prompt, body }).then(() => q.refetch());
          }}
        >
          <input
            id="answer-prompt"
            className="w-full rounded-[var(--radius-control)] border border-border px-3 py-2"
            placeholder="The question"
            required
          />
          <Textarea id="answer-body" placeholder="Your answer, from work you actually did" />
          <Button type="submit" variant="outline">
            Save answer
          </Button>
        </form>
        {q.data.answers.map((a: { id: string; prompt: string; body: string }) => (
          <article key={a.id} className="mt-4">
            <p className="font-medium">{a.prompt}</p>
            <p className="text-muted-foreground">{a.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
