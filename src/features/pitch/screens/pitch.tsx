import { useQuery } from "@tanstack/react-query";
import { listPitchFn, draftBioFn, draftIntroFn } from "@/features/pitch/queries";
import { PitchView } from "@/features/pitch/components/pitch-view";
import { runCommand } from "@/ui/run-command";
import { useState } from "react";

export function PitchScreen() {
  const q = useQuery({ queryKey: ["pitch"], queryFn: () => listPitchFn() });
  const [bio, setBio] = useState<string | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [introNote, setIntroNote] = useState("");
  const empty = q.data && !q.data.bio && !q.data.intro && q.data.answers.length === 0;

  return (
    <PitchView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      empty={Boolean(empty)}
      data={
        q.data
          ? {
              bio: q.data.bio?.body ?? "",
              intro: q.data.intro?.body ?? "",
              answers: q.data.answers.map((a: { id: string; prompt: string; body: string }) => ({
                id: a.id,
                prompt: a.prompt,
                body: a.body,
              })),
            }
          : undefined
      }
      bio={bio ?? q.data?.bio?.body ?? ""}
      onBio={setBio}
      onSaveBio={() =>
        void runCommand("pitch.saveBio", { body: bio ?? q.data?.bio?.body ?? "" }).then(() =>
          q.refetch(),
        )
      }
      onDraftBio={async () => {
        const body = await draftBioFn();
        await runCommand("pitch.saveBio", { body });
        setBio(body);
        await q.refetch();
      }}
      intro={intro ?? q.data?.intro?.body ?? ""}
      onIntro={setIntro}
      onSaveIntro={() =>
        void runCommand("pitch.saveIntro", { body: intro ?? q.data?.intro?.body ?? "" }).then(() =>
          q.refetch(),
        )
      }
      onDraftIntro={async () => {
        const body = await draftIntroFn();
        if (!body) {
          setIntroNote("Set a goal on your profile first.");
          return;
        }
        setIntroNote("");
        await runCommand("pitch.saveIntro", { body });
        setIntro(body);
        await q.refetch();
      }}
      introNote={introNote}
      prompt={prompt}
      onPrompt={setPrompt}
      answer={answer}
      onAnswer={setAnswer}
      onSaveAnswer={() =>
        void runCommand("pitch.addAnswer", { prompt, body: answer }).then(() => {
          setPrompt("");
          setAnswer("");
          q.refetch();
        })
      }
    />
  );
}
