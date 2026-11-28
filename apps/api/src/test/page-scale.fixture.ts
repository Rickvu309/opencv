import { writeFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { eq } from "drizzle-orm"
import { createId } from "../platform/id.js"
import * as schema from "../db/schema.js"
import { seedStoredYDoc } from "@workspace/paper-crdt"
import { richPaper } from "./rich-paper.js"
import { richPaperDocumentSchema } from "@workspace/domain/paper-doc"

const [dataDir, email, out] = process.argv.slice(2)
if (!dataDir || !email || !out || process.env.NODE_ENV === "production")
  throw new Error("A local UI database, account and output path are required")
const client = new PGlite(dataDir)
try {
  const db = drizzle({ client, schema })
  const [owner] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
  if (!owner) throw new Error("Missing local UI account")
  const document = richPaper("cv", `file:${createId()}`)
  const header = document.flow.children[0]!.children[0]!
  if (header.type !== "header") throw new Error("Missing CV header")
  const name = header.children.find(
    (child) => child.type === "cvField" && child.fieldKey === "name"
  )
  if (!name || name.type !== "cvField") throw new Error("Missing CV name")
  name.content = [{ text: "Ada Nguyen" }]
  const lines = [
    "Product designer | Hanoi | ada@example.com",
    "Summary",
    "I design clear, accessible tools for people starting their careers.",
    ...Array.from({ length: 18 }, (_, i) =>
      [
        `Experience ${i + 1}: Product designer`,
        "Career Studio | 2021–2026",
        "Led research and prototyping for a career workspace. Collaborated with engineers to ship accessible workflows, measure outcomes and improve the experience for new graduates.",
      ].join("\n")
    )
      .join("\n")
      .split("\n"),
    "Education",
    "Bachelor of Design, Example University",
  ]
  const seeded = richPaperDocumentSchema.parse({
    ...document,
    flow: {
      ...document.flow,
      children: [
        {
          ...document.flow.children[0]!,
          children: [
            header,
            ...lines.map((text, i) => ({
              id: `paragraph-${i}`,
              type: "paragraph",
              paragraph: {},
              content: [{ text }],
            })),
          ],
        },
      ],
    },
  })
  const id = createId()
  await db.insert(schema.paperDocs).values({
    id,
    userId: owner.id,
    name: "Page scale CV",
    kind: "cv",
    templateId: "simple",
    crdtEpoch: 1,
    crdtBase: Buffer.from(seedStoredYDoc(seeded)),
    crdtDocument: seeded,
    crdtBaseSeq: 1,
    contentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  writeFileSync(out, JSON.stringify({ id }))
} finally {
  await client.close()
}
