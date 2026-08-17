import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPaperFn } from "@/features/paper/queries";
import { runCommand } from "@/ui/run-command";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import type { PaperContent } from "@/features/paper/model";

export function PaperEditorScreen({ paperId }: { paperId: string }) {
  const q = useQuery({
    queryKey: ["paper", paperId],
    queryFn: () => getPaperFn({ data: { id: paperId } }),
  });
  if (q.isPending) return <p>Loading this paper.</p>;
  if (!q.data) {
    return (
      <EmptyState
        title="That paper is not here. Open Paper to see your list."
        action={
          <Link to="/paper" className="text-accent underline">
            Back to Paper
          </Link>
        }
      />
    );
  }
  const paper = q.data;
  const content = paper.content as PaperContent;

  function save(next: PaperContent) {
    void runCommand("paper.updateBlock", { id: paperId, content: next }).then(() => q.refetch());
  }

  return (
    <div>
      <Link to="/paper" className="text-[14px] text-muted-foreground">
        Back
      </Link>
      <div className="mt-4 flex items-center justify-between gap-4">
        <Input
          defaultValue={paper.title}
          onBlur={(e) => void runCommand("paper.rename", { id: paperId, title: e.target.value })}
        />
        <span className="text-[14px] text-muted-foreground">{paper.typeWord}</span>
        <Button variant="outline" onClick={() => window.print()}>
          Export
        </Button>
      </div>
      <article className="a4 mx-auto mt-8 max-w-[720px] border border-black p-10 print:border-0">
        {paper.kind === "cv" ? (
          <>
            <input
              className="w-full text-[22px] font-medium outline-none"
              defaultValue={content.name}
              placeholder="Your name"
              onBlur={(e) => save({ ...content, name: e.target.value })}
            />
            <input
              className="mt-1 w-full text-[14px] outline-none"
              defaultValue={content.contact}
              placeholder="Email · phone · city"
              onBlur={(e) => save({ ...content, contact: e.target.value })}
            />
            <h2 className="mt-8 text-[14px] font-medium uppercase tracking-wide">Experience</h2>
            {content.experience.map((item, i) => (
              <div key={item.id} className="mt-3">
                <input
                  className="w-full outline-none"
                  defaultValue={item.role}
                  placeholder="Role"
                  onBlur={(e) => {
                    const experience = content.experience.map((x, idx) =>
                      idx === i ? { ...x, role: e.target.value } : x,
                    );
                    save({ ...content, experience });
                  }}
                />
                <input
                  className="w-full text-[14px] outline-none"
                  defaultValue={item.org}
                  placeholder="Organisation"
                  onBlur={(e) => {
                    const experience = content.experience.map((x, idx) =>
                      idx === i ? { ...x, org: e.target.value } : x,
                    );
                    save({ ...content, experience });
                  }}
                />
                {item.bullets.map((b, bi) => (
                  <input
                    key={bi}
                    className="w-full text-[14px] outline-none"
                    defaultValue={b}
                    placeholder="A result, with a number if you have one"
                    onBlur={(e) => {
                      const experience = content.experience.map((x, idx) =>
                        idx === i
                          ? { ...x, bullets: x.bullets.map((bb, bbi) => (bbi === bi ? e.target.value : bb)) }
                          : x,
                      );
                      save({ ...content, experience });
                    }}
                  />
                ))}
              </div>
            ))}
            {content.proofLines.length ? (
              <section className="mt-8">
                <h2 className="text-[14px] font-medium uppercase tracking-wide">Proof</h2>
                {content.proofLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </section>
            ) : null}
          </>
        ) : (
          content.paragraphs.map((p, i) => (
            <textarea
              key={i}
              className="mt-4 w-full outline-none"
              defaultValue={p}
              placeholder="Write this paragraph"
              onBlur={(e) => {
                const paragraphs = content.paragraphs.map((x, idx) => (idx === i ? e.target.value : x));
                save({ ...content, paragraphs });
              }}
            />
          ))
        )}
      </article>
    </div>
  );
}
