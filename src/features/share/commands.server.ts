import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { slugify } from "@/lib/utils";
import { newToken } from "@/core/ids";
import bcrypt from "bcryptjs";

defineCommand({
  name: "share.setHandle",
  agent: false,
  description: "Set the public handle for /u/:handle.",
  input: z.object({ handle: z.string().min(3) }),
  async handler({ actor, input, client }) {
    const handle = slugify(input.handle).replace(/^-|-$/g, "");
    const { rows } = await client.query(`select handle from handles where user_id=$1`, [actor.userId]);
    await client.query(
      `insert into handles (user_id, handle) values ($1,$2)
       on conflict (user_id) do update set handle=$2`,
      [actor.userId, handle],
    );
    return {
      result: { handle },
      inverse: rows[0] ? { name: "share.setHandle", input: { handle: rows[0].handle } } : null,
    };
  },
});

defineCommand({
  name: "share.create",
  agent: false,
  description: "Create a share token. Reserved for private views and invites.",
  input: z.object({
    subjectType: z.string(),
    subjectId: z.string(),
    capability: z.enum(["view", "vouch", "invite"]),
  }),
  async handler({ actor, input, client }) {
    const token = newToken();
    await client.query(
      `insert into shares (token, subject_type, subject_id, capability, created_by)
       values ($1,$2,$3,$4,$5)`,
      [token, input.subjectType, input.subjectId, input.capability, actor.userId],
    );
    return { result: { token }, inverse: { name: "share.revoke", input: { token } } };
  },
});

defineCommand({
  name: "share.revoke",
  agent: false,
  description: "Revoke a share token.",
  input: z.object({ token: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from shares where token=$1 and created_by=$2`, [
      input.token,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "account.updateEmail",
  agent: false,
  description: "Change email after checking the current password.",
  input: z.object({ email: z.string().email(), password: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(`select email, password_hash from users where id=$1`, [actor.userId]);
    if (!(await bcrypt.compare(input.password, rows[0].password_hash))) {
      throw new Error("that password did not match");
    }
    await client.query(`update users set email=$2 where id=$1`, [
      actor.userId,
      input.email.trim().toLowerCase(),
    ]);
    return {
      result: { ok: true },
      inverse: { name: "account.updateEmail", input: { email: rows[0].email, password: input.password } },
    };
  },
});

defineCommand({
  name: "account.updatePassword",
  agent: false,
  description: "Change password after checking the current password.",
  input: z.object({ current: z.string(), next: z.string().min(8) }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(`select password_hash from users where id=$1`, [actor.userId]);
    if (!(await bcrypt.compare(input.current, rows[0].password_hash))) {
      throw new Error("that password did not match");
    }
    const hash = await bcrypt.hash(input.next, 12);
    await client.query(`update users set password_hash=$2 where id=$1`, [actor.userId, hash]);
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "account.setNotificationPrefs",
  agent: false,
  description: "Choose which notifications reach email.",
  input: z.object({ deadline: z.boolean(), idle: z.boolean() }),
  async handler({ actor, input, client }) {
    await client.query(`update users set notification_prefs=$2::jsonb where id=$1`, [
      actor.userId,
      JSON.stringify(input),
    ]);
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "account.remove",
  agent: false,
  destructive: true,
  description: "Delete the account and everything in it.",
  input: z.object({ confirm: z.literal("delete") }),
  async handler({ actor, client }) {
    await client.query(`delete from users where id=$1`, [actor.userId]);
    return { result: { ok: true }, inverse: null };
  },
});
