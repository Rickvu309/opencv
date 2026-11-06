import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { expect } from "vitest"
import { agentConnections, oauthClient } from "../db/schema.js"
import type { CoverageCase, CoverageTools } from "./coverage-helpers.js"

export function connectionsCases({
  db,
  userId,
  run,
}: CoverageTools): CoverageCase[] {
  const id = randomUUID()
  const clientId = randomUUID()
  return [
    {
      name: "connections.revoke",
      arrange: async () => {
        await db
          .insert(oauthClient)
          .values({ id: clientId, clientId, redirectUris: [] })
        await db.insert(agentConnections).values({
          id,
          userId,
          clientId,
          authorizationCodeId: randomUUID(),
          name: "Test agent",
          audience: "https://api.example.com/mcp",
          scopes: ["connection.status"],
          resources: { kind: "none" },
          policy: { reads: "allow", writes: "approval" },
          expiresAt: new Date(Date.now() + 3600000),
        })
      },
      act: () => run("connections.revoke", { connectionId: id }),
      assert: async () => {
        const [row] = await db
          .select()
          .from(agentConnections)
          .where(eq(agentConnections.id, id))
        expect(row?.revokedAt).toBeInstanceOf(Date)
        expect(row?.version).toBe(2)
      },
    },
  ]
}
