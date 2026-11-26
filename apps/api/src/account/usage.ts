import {
  coachLimitMessage,
  dailyTurnCap,
  dayWindow,
  sessionHours,
  sessionWindow,
  usageSnapshot,
  weekWindow,
  type Plan,
} from "@workspace/domain/account"
import { type CoachMode } from "@workspace/domain/coach"
import { ERROR_CODES, parseUserId } from "@workspace/domain/kernel"
import { and, eq, gte, sql } from "drizzle-orm"

import { coachModelEnv, type CoachModelEnv } from "../platform/config.js"
import { getDb } from "../db/context.js"
import { coachUsage } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import { getProfileRow } from "./store.js"

async function countSince(userId: string, mode: CoachMode, since: Date) {
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(coachUsage)
    .where(
      and(
        eq(coachUsage.userId, userId),
        eq(coachUsage.mode, mode),
        gte(coachUsage.createdAt, since)
      )
    )
  return Number(rows[0]?.total ?? 0)
}

export async function readUsage(
  userId: string,
  now = new Date(),
  env: CoachModelEnv = coachModelEnv()
) {
  const id = parseUserId(userId)
  const profile = await getProfileRow(id)
  const plan = profile.plan as Plan
  const mode = profile.coachMode
  const cap = dailyTurnCap(plan, mode, env)
  const hours = sessionHours(env)
  const day = dayWindow(now, profile.timeZone)
  const week = weekWindow(now, profile.timeZone)
  const session = sessionWindow(now, profile.timeZone, hours)
  const [sessionTurns, dayTurns, weekTurns] = await Promise.all([
    countSince(id, mode, session.start),
    countSince(id, mode, day.start),
    countSince(id, mode, week.start),
  ])
  return usageSnapshot({
    plan,
    mode,
    timeZone: profile.timeZone,
    now,
    sessionTurns,
    dayTurns,
    weekTurns,
    cap,
    sessionHours: hours,
  })
}

export async function assertDayCap(
  userId: string,
  mode: CoachMode,
  now = new Date(),
  env: CoachModelEnv = coachModelEnv()
) {
  const id = parseUserId(userId)
  const profile = await getProfileRow(id)
  const plan = profile.plan as Plan
  const cap = dailyTurnCap(plan, mode, env)
  if (cap <= 0) return { plan, cap, profile }
  const day = dayWindow(now, profile.timeZone)
  const used = await countSince(id, mode, day.start)
  if (used >= cap) {
    throw new CommandError(
      ERROR_CODES.COACH_LIMIT_REACHED,
      coachLimitMessage(plan, mode),
      {
        resetsAt: day.resetsAt.toISOString(),
        window: "day",
        mode,
        plan,
      }
    )
  }
  return { plan, cap, profile }
}
