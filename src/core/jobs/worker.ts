import { newId } from "@/core/ids";
import { claimJob, failJob, finishJob } from "@/core/jobs/queue";
import { withClient } from "@/core/db/client.server";
import { purgeExpiredSessions } from "@/core/auth/store";

const workerId = `w_${newId()}`;
const PURGE_EVERY_MS = 5 * 60 * 1000;
let lastPurge = 0;

type Handler = (payload: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerJob(kind: string, handler: Handler) {
  handlers.set(kind, handler);
}

export async function tick() {
  if (handlers.size === 0) registerBuiltins();
  if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
    lastPurge = Date.now();
    await purgeExpiredSessions();
  }
  const job = await claimJob(workerId);
  if (!job) return false;
  const handler = handlers.get(job.kind);
  try {
    if (!handler) throw new Error(`no handler for ${job.kind}`);
    await handler(job.payload);
    await finishJob(job.id);
  } catch (error) {
    await failJob(job.id, error instanceof Error ? error.message : "failed");
  }
  return true;
}

export async function serve() {
  registerBuiltins();
  console.log(`worker ${workerId} draining jobs`);
  for (;;) {
    const did = await tick();
    if (!did) await new Promise((r) => setTimeout(r, 2000));
  }
}

function registerBuiltins() {
  registerJob("session.purge", async () => {
    await purgeExpiredSessions();
  });
  registerJob("notify.deadline", async (payload) => {
    const p = payload as { userId: string; applicationId: string; role: string };
    await withClient((c) =>
      c.query(
        `insert into notifications (id, user_id, kind, payload)
         values ($1,$2,'deadline',$3::jsonb)`,
        [
          newId(),
          p.userId,
          JSON.stringify({
            applicationId: p.applicationId,
            text: `deadline approaching for ${p.role}`,
          }),
        ],
      ),
    );
  });
}
