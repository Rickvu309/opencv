import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";
import { loadProfile } from "@/features/profile/load.server";
import { profilePlaintext } from "@/features/profile/model";
import { extractRequirements, scoreFit } from "@/features/search/fit";

defineCommand({
  name: "opening.add",
  agent: true,
  description: "Add a job posting from pasted text. Pass the text verbatim; do not summarise first.",
  input: z.object({
    rawText: z.string(),
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    url: z.string().optional(),
  }),
  async handler({ actor, input, client }) {
    const profile = await loadProfile(actor.userId);
    const requirements = extractRequirements(input.rawText);
    const fit = scoreFit(requirements, profilePlaintext(profile));
    const id = newId();
    const title =
      input.title ||
      input.rawText.split("\n").find((l) => l.trim())?.slice(0, 80) ||
      "Pasted opening";
    await client.query(
      `insert into openings (id, user_id, title, company, location, url, raw_text, requirements, fit)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
      [
        id,
        actor.userId,
        title,
        input.company ?? "",
        input.location ?? "",
        input.url ?? "",
        input.rawText,
        JSON.stringify(requirements),
        JSON.stringify(fit),
      ],
    );
    return { result: { id, fit }, inverse: { name: "opening.remove", input: { id } } };
  },
});

defineCommand({
  name: "opening.refresh",
  agent: true,
  description: "Re-score an opening against the current profile.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    const profile = await loadProfile(actor.userId);
    const { rows } = await client.query(
      `select requirements from openings where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const fit = scoreFit(rows[0]?.requirements ?? [], profilePlaintext(profile));
    await client.query(`update openings set fit=$3::jsonb where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
      JSON.stringify(fit),
    ]);
    return { result: { fit }, inverse: null };
  },
});

defineCommand({
  name: "opening.remove",
  agent: true,
  destructive: true,
  description: "Remove a saved opening.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from openings where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});
