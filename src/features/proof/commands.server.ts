import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";
import { slugify } from "@/lib/utils";
import { buildProofPageContent, proofPageDate } from "@/features/proof/model";

defineCommand({
  name: "proof.create",
  agent: true,
  description: "Start a Proof space. A title is enough.",
  input: z.object({ title: z.string() }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into proofs (id, user_id, title) values ($1,$2,$3)`,
      [id, actor.userId, input.title],
    );
    return { result: { id }, inverse: { name: "proof.remove", input: { id } } };
  },
});

defineCommand({
  name: "proof.updateMeta",
  agent: true,
  description: "Update a Proof title, role, dates, or link.",
  input: z.object({
    id: z.string(),
    title: z.string().optional(),
    role: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    link: z.string().optional(),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select title, role, date_from, date_to, link from proofs where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const prev = rows[0];
    await client.query(
      `update proofs set
        title = coalesce($3, title),
        role = coalesce($4, role),
        date_from = coalesce($5, date_from),
        date_to = coalesce($6, date_to),
        link = coalesce($7, link),
        updated_at = now()
       where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.title ?? null, input.role ?? null, input.dateFrom ?? null, input.dateTo ?? null, input.link ?? null],
    );
    return {
      result: { ok: true },
      inverse: prev
        ? {
            name: "proof.updateMeta",
            input: {
              id: input.id,
              title: prev.title,
              role: prev.role,
              dateFrom: prev.date_from,
              dateTo: prev.date_to,
              link: prev.link,
            },
          }
        : null,
    };
  },
});

defineCommand({
  name: "proof.log",
  agent: true,
  description: "Add a log entry to a Proof. Use the user's own words.",
  input: z.object({
    proofId: z.string(),
    kind: z.enum(["note", "link", "photo"]).default("note"),
    body: z.string().default(""),
    url: z.string().default(""),
  }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into proof_entries (id, proof_id, kind, body, url) values ($1,$2,$3,$4,$5)`,
      [id, input.proofId, input.kind, input.body, input.url],
    );
    await client.query(`update proofs set updated_at=now() where id=$1 and user_id=$2`, [
      input.proofId,
      actor.userId,
    ]);
    return { result: { id }, inverse: { name: "proof.removeEntry", input: { id } } };
  },
});

defineCommand({
  name: "proof.updateEntry",
  agent: true,
  description: "Edit a Proof log entry.",
  input: z.object({ id: z.string(), body: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select e.body from proof_entries e join proofs p on p.id = e.proof_id
       where e.id=$1 and p.user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(`update proof_entries set body=$2 where id=$1`, [input.id, input.body]);
    return {
      result: { ok: true },
      inverse: { name: "proof.updateEntry", input: { id: input.id, body: rows[0]?.body } },
    };
  },
});

defineCommand({
  name: "proof.removeEntry",
  agent: true,
  destructive: true,
  description: "Remove a Proof log entry.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(
      `delete from proof_entries e using proofs p where e.id=$1 and e.proof_id=p.id and p.user_id=$2`,
      [input.id, actor.userId],
    );
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "proof.arrange",
  agent: true,
  description: "Save the arranged three-part story draft. Do not invent facts.",
  input: z.object({
    id: z.string(),
    what: z.string(),
    did: z.string(),
    came: z.string(),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select page_draft from proofs where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update proofs set page_draft=$3::jsonb, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, JSON.stringify({ what: input.what, did: input.did, came: input.came })],
    );
    return {
      result: { ok: true },
      inverse: { name: "proof.arrange", input: { id: input.id, ...(rows[0]?.page_draft ?? { what: "", did: "", came: "" }) } },
    };
  },
});

defineCommand({
  name: "proof.skipQuestion",
  agent: true,
  description: "Skip the one interview question. Publish still works. Do not invent an answer.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    const { rowCount } = await client.query(
      `update proofs
          set page_draft = coalesce(page_draft, '{}'::jsonb) || '{"skippedQuestion": true}'::jsonb,
              updated_at = now()
        where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    return { result: { ok: Boolean(rowCount) }, inverse: null };
  },
});

defineCommand({
  name: "proof.publish",
  agent: true,
  description:
    "Publish the user's own words and date to a public page. Arrange is not required. Do not invent facts or numbers. Later edits do not change the live page until republished.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select title, role, date_from, date_to, page_draft from proofs where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const proof = rows[0] as
      | {
          title: string;
          role: string;
          date_from: string;
          date_to: string;
          page_draft: { what?: unknown; did?: unknown; came?: unknown } | null;
        }
      | undefined;
    if (!proof) return { result: { ok: false, slug: "" }, inverse: null };
    const entries = (
      await client.query<{ body: string; created_at: Date }>(
        `select body, created_at from proof_entries
         where proof_id=$1 and body <> ''
         order by created_at asc`,
        [input.id],
      )
    ).rows;
    const words = entries.map((entry) => entry.body).join("\n\n").trim();
    if (!words) return { result: { ok: false, slug: "" }, inverse: null };
    const content = buildProofPageContent({
      words,
      date: proofPageDate({ dateFrom: proof.date_from, dateTo: proof.date_to }, entries),
      title: proof.title,
      role: proof.role,
      draft: proof.page_draft,
    });
    const slug = `${slugify(content.title || words) || "proof"}-${input.id.slice(0, 6)}`;
    await client.query(
      `insert into proof_pages (proof_id, user_id, slug, content)
       values ($1,$2,$3,$4::jsonb)
       on conflict (proof_id) do update set slug=$3, content=$4::jsonb, published_at=now()`,
      [input.id, actor.userId, slug, JSON.stringify(content)],
    );
    await client.query(
      `update proofs set status='published', updated_at=now() where id=$1`,
      [input.id],
    );
    return {
      result: { ok: true, slug },
      inverse: { name: "proof.unpublish", input: { id: input.id } },
    };
  },
});

defineCommand({
  name: "proof.unpublish",
  agent: true,
  description: "Take a published Proof page down.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(
      `delete from proof_pages where proof_id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update proofs set status='logging', updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "proof.remove",
  agent: true,
  destructive: true,
  description: "Delete a Proof.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from proofs where id=$1 and user_id=$2`, [input.id, actor.userId]);
    return { result: { ok: true }, inverse: null };
  },
});
