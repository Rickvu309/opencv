import {
  decodePaperContent,
  isCvDocument,
  type CoachFocusDoc,
} from "@workspace/domain"

import {
  describeExperienceRoles,
  namedOtherCvSection,
  namesExperienceOrBullet,
  type OtherCvSectionName,
} from "./focus-doc.js"
import { findFocusRewriteOriginal } from "./rewrite.js"

export * from "./focus-doc.js"
export * from "./must-edit-intent.js"
export * from "./replacement-text.js"
export * from "./rewrite.js"
export * from "./tool-dump.js"

/** True when the reply already names a role or company from Experience. */
export function textNamesExperienceRole(
  text: string,
  doc: CoachFocusDoc | undefined
): boolean {
  if (!doc || !text.trim()) return false
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return false
  const lower = text.toLowerCase()
  return decoded.data.experience.some((role) => {
    const labels = [role.role, ...role.role.split(/\s*·\s*/), role.company]
      .map((label) => label.trim())
      .filter((label) => label.length >= 4)
    return labels.some((label) => lower.includes(label.toLowerCase()))
  })
}

/** Named Experience/bullet ask with no scoring bullet — fail closed. */
export function isExperienceNamedMiss(
  doc: CoachFocusDoc | undefined,
  userText: string,
  selectionText?: string
): boolean {
  if (!namesExperienceOrBullet(userText)) return false
  if (!doc) return true
  return findFocusRewriteOriginal(doc, userText, selectionText) === null
}

function describeNamedSection(
  doc: CoachFocusDoc,
  section: OtherCvSectionName
): string[] {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return []
  const content = decoded.data
  switch (section) {
    case "Education":
      return content.education.map((row) =>
        row.degree ? `${row.degree} · ${row.school}` : row.school
      )
    case "Skills":
      return content.skills.map((group) => group.label)
    case "Projects":
      return (content.projects ?? []).map((project) => project.name)
    case "Headline":
      return content.headline ? [content.headline] : []
    case "Contact": {
      const contact = [
        content.contact.location,
        content.contact.email,
        content.contact.phone,
      ].filter((value) => value.length > 0)
      return contact
    }
    case "Languages":
      return content.languages ?? []
  }
}

export function mustEditMissCopy(
  doc: CoachFocusDoc | undefined,
  userText: string
): { receipt: string; nextStep: string } {
  if (doc && namesExperienceOrBullet(userText)) {
    const roles = describeExperienceRoles(doc)
    if (roles.length > 0) {
      return {
        receipt: "Could not match a bullet in Experience.",
        nextStep: `Could not match a bullet in Experience. Next step: name ${formatRoleList(roles)}.`,
      }
    }
    return {
      receipt: "Could not match a bullet in Experience.",
      nextStep:
        "Could not match a bullet in Experience. Next step: add a role or name a section that is already on the CV.",
    }
  }
  const other = namedOtherCvSection(userText)
  if (doc && other) {
    const items = describeNamedSection(doc, other)
    if (items.length > 0) {
      return {
        receipt: `Could not rewrite ${other}.`,
        nextStep: `Could not rewrite ${other}. Next step: name ${formatRoleList(items)}.`,
      }
    }
    return {
      receipt: `Could not rewrite ${other}.`,
      nextStep: `Could not rewrite ${other}. Next step: add ${other.toLowerCase()} or name a section that is already on the CV.`,
    }
  }
  return {
    receipt: "Could not apply the rewrite to the open document.",
    nextStep:
      "Could not update the open document. Next step: name the section or bullet to change.",
  }
}

/** Model produced no real rewrite — do not invent scout or canned CV copy. */
export function mustEditNoRewriteCopy(): { receipt: string; nextStep: string } {
  return {
    receipt: "Could not rewrite the line.",
    nextStep:
      "Could not rewrite the line. Next step: try sending the ask again.",
  }
}

function formatRoleList(roles: string[]): string {
  if (roles.length === 1) return roles[0] ?? ""
  if (roles.length === 2) return `${roles[0]} or ${roles[1]}`
  return `${roles.slice(0, -1).join(", ")}, or ${roles[roles.length - 1]}`
}
