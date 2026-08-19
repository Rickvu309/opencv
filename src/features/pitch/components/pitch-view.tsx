import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Card } from "@/ui/card";
import { Section } from "@/ui/section";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { InfoBlock } from "@/ui/info-block";
import { SkeletonSection } from "@/ui/skeleton";

export type PitchAnswer = { id: string; prompt: string; body: string };

export type PitchViewData = {
  bio: string;
  intro: string;
  answers: PitchAnswer[];
};

export function PitchView({
  pending,
  error,
  onRetry,
  empty,
  data,
  bio,
  onBio,
  onSaveBio,
  onDraftBio,
  intro,
  onIntro,
  onSaveIntro,
  onDraftIntro,
  introNote,
  prompt,
  onPrompt,
  answer,
  onAnswer,
  onSaveAnswer,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  data?: PitchViewData;
  bio: string;
  onBio: (value: string) => void;
  onSaveBio: () => void;
  onDraftBio: () => void;
  intro: string;
  onIntro: (value: string) => void;
  onSaveIntro: () => void;
  onDraftIntro: () => void;
  introNote: string;
  prompt: string;
  onPrompt: (value: string) => void;
  answer: string;
  onAnswer: (value: string) => void;
  onSaveAnswer: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <Band title="Pitch" />
      {pending ? <SkeletonSection /> : null}
      {error ? <QueryError onRetry={() => onRetry?.()} /> : null}
      {data ? (
        empty ? (
          <EmptyState
            kind="first-run"
            title="Say who you are once, properly."
            action={<Button onClick={onDraftBio}>Draft the bio from your profile</Button>}
          />
        ) : (
          <>
            <Section label="Bio">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => onBio(e.target.value)} />
              <div className="flex flex-wrap justify-end gap-2 pt-3">
                <Button variant="outline" onClick={onDraftBio}>
                  Draft from profile
                </Button>
                <Button onClick={onSaveBio}>Save bio</Button>
              </div>
            </Section>
            <Section label="Intro">
              <Label htmlFor="intro">Intro</Label>
              <Textarea id="intro" value={intro} onChange={(e) => onIntro(e.target.value)} />
              {introNote ? (
                <InfoBlock className="mt-3">
                  {introNote}{" "}
                  <a href="/profile" className="text-accent underline-offset-2 hover:underline">
                    Open Profile
                  </a>
                </InfoBlock>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-3">
                <Button variant="outline" onClick={onDraftIntro}>
                  Draft intro
                </Button>
                <Button onClick={onSaveIntro}>Save intro</Button>
              </div>
            </Section>
            <Section label="Answers">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveAnswer();
                }}
              >
                <div>
                  <Label htmlFor="answer-prompt">The question</Label>
                  <Input
                    id="answer-prompt"
                    value={prompt}
                    onChange={(e) => onPrompt(e.target.value)}
                    placeholder="The question"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="answer-body">Your answer</Label>
                  <Textarea
                    id="answer-body"
                    value={answer}
                    onChange={(e) => onAnswer(e.target.value)}
                    placeholder="Your answer, from work you actually did"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Save answer</Button>
                </div>
              </form>
              {data.answers.map((a) => (
                <Card key={a.id} className="mt-4">
                  <p className="text-[15px] font-[510] leading-[1.5]">{a.prompt}</p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-ink-muted">{a.body}</p>
                </Card>
              ))}
            </Section>
          </>
        )
      ) : null}
    </div>
  );
}
