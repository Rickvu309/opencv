import assert from "node:assert/strict"
import { test } from "node:test"

import { migrateTouchButtons } from "./kit-touch-codemod.mjs"

test("a Button with only the height pair moves to the kit size and drops its className", () => {
  const { source, moved } = migrateTouchButtons(
    `export const save = <Button className="h-11 md:h-8" type="submit">Save</Button>`
  )
  assert.equal(
    source,
    `export const save = <Button size="touch" type="submit">Save</Button>`
  )
  assert.deepEqual(moved, [{ line: 1, kitSize: "touch" }])
})

test("a Button keeps its other classes and a lone cn argument is unwrapped", () => {
  const { source } = migrateTouchButtons(
    `export const a = <Button size="lg" className={cn("h-11 md:h-9", ROW)} />
export const b = <Button className="h-11 w-full md:h-8 md:w-auto" />`
  )
  assert.equal(
    source,
    `export const a = <Button size="touch-lg" className={ROW} />
export const b = <Button size="touch" className="w-full md:w-auto" />`
  )
})

test("a small Button, or a filled Button whose padding would change, is left for a person", () => {
  const before = `export const a = <Button size="sm" className="h-11 md:h-8" />
export const b = <Button variant="primary" className="h-11 md:h-9" />`
  const { source, left } = migrateTouchButtons(before)
  assert.equal(source, before)
  assert.deepEqual(
    left.map(({ line }) => line),
    [1, 2]
  )
})

test("running the codemod twice changes nothing the second time", () => {
  const once = migrateTouchButtons(
    `export const a = <Button className="h-11 md:h-8">Go</Button>`
  ).source
  assert.equal(migrateTouchButtons(once).source, once)
})
