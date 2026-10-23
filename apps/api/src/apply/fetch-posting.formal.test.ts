import fc from "fast-check"
import { describe, it, vi } from "vitest"

import {
  assertPublicApplyScanUrl,
  createFetchJobPosting,
  isBlockedApplyScanHost,
  type JobPostingLookup,
} from "./fetch-posting.js"

const SEED = Number(process.env.FORMAL_SEED ?? 241)
const NUM_RUNS = 400

const publicLookup: JobPostingLookup = async () => ({
  address: "93.184.216.34",
  family: 4,
})

type Verdict = "blocked" | "public"

const SCHEMES: ReadonlyArray<readonly [string, boolean]> = [
  ["http", true],
  ["https", true],
  ["HTTPS", true],
  ["ftp", false],
  ["file", false],
  ["javascript", false],
  ["data", false],
]
const HTTP_SCHEMES = SCHEMES.filter(([, ok]) => ok).map(([s]) => s)
const OTHER_SCHEMES = SCHEMES.filter(([, ok]) => !ok).map(([s]) => s)

const USERINFOS = ["", "user@", "user:pw@"]
const PORTS = ["", ":80", ":8443"]
const TAILS = ["", "/x", "?q=1", "#f"]

const HOSTS: ReadonlyArray<readonly [string, Verdict]> = [
  ["localhost", "blocked"],
  ["localhost.localdomain", "blocked"],
  ["metadata.google.internal", "blocked"],
  ["metadata.internal", "blocked"],
  ["foo.localhost", "blocked"],
  ["printer.local", "blocked"],
  ["db.internal", "blocked"],
  ["127.0.0.1", "blocked"],
  ["127.255.255.254", "blocked"],
  ["0.0.0.0", "blocked"],
  ["169.254.169.254", "blocked"],
  ["10.0.0.1", "blocked"],
  ["172.16.0.1", "blocked"],
  ["172.31.255.255", "blocked"],
  ["192.168.0.1", "blocked"],
  ["100.64.0.1", "blocked"],
  ["100.127.255.255", "blocked"],
  ["[::1]", "blocked"],
  ["[fe80::1]", "blocked"],
  ["[fd00::1]", "blocked"],
  ["[fd00:ec2::254]", "blocked"],
  ["[::ffff:127.0.0.1]", "blocked"],
  ["[::ffff:7f00:1]", "blocked"],
  ["[::ffff:10.0.0.1]", "blocked"],
  ["[::ffff:169.254.169.254]", "blocked"],
  ["[::ffff:c0a8:1]", "blocked"],
  ["example.com", "public"],
  ["jobs.lever.co", "public"],
  ["fda.gov", "public"],
  ["fdic.gov", "public"],
  ["fcbarcelona.com", "public"],
  ["93.184.216.34", "public"],
  ["172.32.0.1", "public"],
]
const BLOCKED_HOSTS = HOSTS.filter(([, v]) => v === "blocked").map(([h]) => h)
const PUBLIC_HOSTS = HOSTS.filter(([, v]) => v === "public").map(([h]) => h)

const urlOf = (
  scheme: string,
  userinfo: string,
  host: string,
  port: string,
  tail: string
) => `${scheme}://${userinfo}${host}${port}${tail}`

type Tuple = {
  scheme: string
  userinfo: string
  host: string
  port: string
  tail: string
}

function grid(
  schemes: string[],
  hosts: string[],
  shape: (userinfo: string, port: string) => boolean
): Tuple[] {
  const out: Tuple[] = []
  for (const scheme of schemes)
    for (const userinfo of USERINFOS)
      for (const host of hosts)
        for (const port of PORTS)
          for (const tail of TAILS)
            if (shape(userinfo, port))
              out.push({ scheme, userinfo, host, port, tail })
  return out
}

const bare = (userinfo: string, port: string) => userinfo === "" && port === ""
const shaped = (userinfo: string, port: string) => !bare(userinfo, port)
const anyShape = () => true

async function reachesFetch(
  url: string,
  lookupImpl: JobPostingLookup | null
): Promise<boolean> {
  const spy = vi.fn(async () => new Response("<html></html>", { status: 200 }))
  const result = await createFetchJobPosting({
    fetchImpl: spy as unknown as typeof fetch,
    lookupImpl,
  })(url)
  return spy.mock.calls.length > 0 || result.ok
}

async function badUrlProblems(url: string): Promise<string[]> {
  const problems: string[] = []
  if (await reachesFetch(url, null)) problems.push("no lookup")
  if (await reachesFetch(url, publicLookup)) problems.push("lenient lookup")
  return problems
}

async function sweepBad(tuples: Tuple[]): Promise<string[]> {
  const problems: string[] = []
  for (const t of tuples) {
    const url = urlOf(t.scheme, t.userinfo, t.host, t.port, t.tail)
    const variants = await badUrlProblems(url)
    if (variants.length > 0) {
      problems.push(`${url} reached fetch (${variants.join(", ")})`)
    }
  }
  return problems
}

async function sweepPublic(tuples: Tuple[]): Promise<string[]> {
  const problems: string[] = []
  for (const t of tuples) {
    const url = urlOf(t.scheme, t.userinfo, t.host, t.port, t.tail)
    const result = await assertPublicApplyScanUrl(url)
    if (!result.ok) problems.push(url)
  }
  return problems
}

const letter = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split(""))
const alnum = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
)
const label = fc
  .tuple(letter, fc.array(alnum, { maxLength: 8 }))
  .map(([first, rest]) => first + rest.join(""))
const prefixedLabel = fc
  .tuple(
    fc.constantFrom("fc", "fd", "fe80", "fe", "f"),
    fc.array(alnum, { maxLength: 6 })
  )
  .map(([prefix, rest]) => prefix + rest.join(""))
const tld = fc.constantFrom("com", "gov", "co", "io", "vn", "org")

const octet = (lo: number, hi: number) =>
  fc.oneof(fc.integer({ min: lo, max: hi }), fc.constantFrom(lo, hi))
const edgeOctet = fc.constantFrom(
  15,
  16,
  31,
  32,
  63,
  64,
  127,
  128,
  167,
  168,
  169,
  253,
  254,
  255
)

// Independent of isPrivateIPv4: the ranges the guard documents, as data.
const PRIVATE_V4_RANGES: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [0, 0, 0, 255],
  [10, 10, 0, 255],
  [127, 127, 0, 255],
  [169, 169, 254, 254],
  [172, 172, 16, 31],
  [192, 192, 168, 168],
  [100, 100, 64, 127],
]
const isPrivateV4Spec = (a: number, b: number) =>
  PRIVATE_V4_RANGES.some(
    ([aLo, aHi, bLo, bHi]) => a >= aLo && a <= aHi && b >= bLo && b <= bHi
  )

const publicIPv4 = fc
  .tuple(
    fc.oneof(
      octet(1, 223),
      fc.constantFrom(9, 11, 99, 101, 126, 128, 168, 170, 171, 173, 191, 193)
    ),
    fc.oneof(octet(0, 255), edgeOctet),
    octet(0, 255),
    octet(0, 255)
  )
  .filter(([a, b]) => !isPrivateV4Spec(a, b))
  .map((q) => q.join("."))

const publicHost = fc.oneof(
  fc.constantFrom("fda.gov", "fdic.gov", "fcbarcelona.com"),
  fc.tuple(label, tld).map(([l, t]) => `${l}.${t}`),
  fc.tuple(prefixedLabel, tld).map(([l, t]) => `${l}.${t}`),
  fc.tuple(label, label, tld).map(([a, b, t]) => `${a}.${b}.${t}`),
  publicIPv4
)

const blockedV4 = fc.oneof(
  fc
    .tuple(octet(0, 255), octet(0, 255), octet(0, 255))
    .map(([b, c, d]) => `127.${b}.${c}.${d}`),
  fc.tuple(octet(0, 255), octet(0, 255)).map(([c, d]) => `169.254.${c}.${d}`),
  fc
    .tuple(octet(0, 255), octet(0, 255), octet(0, 255))
    .map(([b, c, d]) => `10.${b}.${c}.${d}`),
  fc
    .tuple(octet(16, 31), octet(0, 255), octet(0, 255))
    .map(([b, c, d]) => `172.${b}.${c}.${d}`),
  fc.tuple(octet(0, 255), octet(0, 255)).map(([c, d]) => `192.168.${c}.${d}`),
  fc
    .tuple(octet(64, 127), octet(0, 255), octet(0, 255))
    .map(([b, c, d]) => `100.${b}.${c}.${d}`)
)
const blockedNamed = fc.oneof(
  fc.constantFrom(
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata.internal"
  ),
  fc
    .tuple(label, fc.constantFrom("localhost", "local", "internal"))
    .map(([l, s]) => `${l}.${s}`)
)
const blockedV6 = fc.constantFrom(
  "[::1]",
  "[fe80::1]",
  "[fd12:3456::1]",
  "[fc00::1]",
  "[fd00:ec2::254]",
  "[::ffff:127.0.0.1]",
  "[::ffff:7f00:1]",
  "[::ffff:10.0.0.1]",
  "[::ffff:a9fe:a9fe]",
  "[::ffff:c0a8:1]"
)
const blockedHost = fc.oneof(blockedV4, blockedNamed, blockedV6)

const userinfo = fc.constantFrom("", "user@", "user:pw@", "a%40b@")
const port = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 1, max: 65535 }).map((n) => `:${n}`)
)
const path = fc.oneof(
  fc.constantFrom("", "/", "/x", "/jobs/1", "?q=1", "#f"),
  fc.array(label, { maxLength: 3 }).map((p) => `/${p.join("/")}`)
)
const httpScheme = fc.constantFrom("http", "https", "HTTP", "HTTPS")
const otherScheme = fc.constantFrom(
  "ftp",
  "file",
  "javascript",
  "data",
  "gopher",
  "ws"
)

async function runProperty<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>
): Promise<string | null> {
  const details = await fc.check(fc.asyncProperty(arb, predicate), {
    numRuns: NUM_RUNS,
    seed: SEED,
  })
  return details.failed
    ? `fast-check counterexample after ${details.numRuns} runs: ${JSON.stringify(details.counterexample)}`
    : null
}

function report(
  title: string,
  tupleCount: number,
  sweepProblems: string[],
  witnesses: string[],
  counterexample: string | null
): string | null {
  console.info(
    `[formal] ${title}: sweep ${tupleCount} tuples, ${sweepProblems.length} failing; fast-check ${NUM_RUNS} runs seed ${SEED}`
  )
  const lines: string[] = witnesses.map((w) => `witness: ${w}`)
  if (sweepProblems.length > 0) {
    lines.push(
      `sweep: ${sweepProblems.length} failing of ${tupleCount} tuples, first 6:`,
      ...sweepProblems.slice(0, 6).map((p) => `  ${p}`)
    )
  }
  if (counterexample) lines.push(counterexample)
  return lines.length > 0 ? lines.join("\n") : null
}

describe("Apply scan URL guard (formal)", () => {
  it("F1: no public hostname is refused", async () => {
    const tuples = grid(HTTP_SCHEMES, PUBLIC_HOSTS, anyShape)
    const sweepProblems = await sweepPublic(tuples)
    const witnesses: string[] = []
    for (const host of PUBLIC_HOSTS) {
      if (isBlockedApplyScanHost(host)) {
        witnesses.push(`isBlockedApplyScanHost("${host}") -> true`)
      }
    }
    for (const url of [
      "https://fda.gov/jobs/1",
      "https://fdic.gov/careers",
      "https://fcbarcelona.com/jobs",
    ]) {
      const result = await assertPublicApplyScanUrl(url)
      if (!result.ok) witnesses.push(`${url} -> ok:false`)
    }
    const counterexample = await runProperty(
      fc.tuple(httpScheme, userinfo, publicHost, port, path),
      async ([scheme, user, host, p, tail]) => {
        const url = urlOf(scheme, user, host, p, tail)
        return (await assertPublicApplyScanUrl(url)).ok
      }
    )
    const problem = report(
      "F1",
      tuples.length,
      sweepProblems,
      witnesses,
      counterexample
    )
    if (problem) throw new Error(problem)
  }, 60_000)

  it("F2: no blocked host reaches fetch when it carries a port or userinfo", async () => {
    const tuples = grid(HTTP_SCHEMES, BLOCKED_HOSTS, shaped)
    const sweepProblems = await sweepBad(tuples)
    const witnesses: string[] = []
    for (const url of ["http://user@127.0.0.1/x", "http://localhost:3000/x"]) {
      const variants = await badUrlProblems(url)
      if (variants.length > 0) {
        witnesses.push(`${url} reached fetch (${variants.join(", ")})`)
      }
    }
    const counterexample = await runProperty(
      fc
        .tuple(httpScheme, userinfo, blockedHost, port, path)
        .filter(([, user, , p]) => user !== "" || p !== ""),
      async ([scheme, user, host, p, tail]) =>
        (await badUrlProblems(urlOf(scheme, user, host, p, tail))).length === 0
    )
    const problem = report(
      "F2",
      tuples.length,
      sweepProblems,
      witnesses,
      counterexample
    )
    if (problem) throw new Error(problem)
  }, 60_000)

  it("no bare blocked host reaches fetch", async () => {
    const tuples = grid(HTTP_SCHEMES, BLOCKED_HOSTS, bare)
    const sweepProblems = await sweepBad(tuples)
    const witnesses: string[] = []
    for (const host of BLOCKED_HOSTS) {
      if (!isBlockedApplyScanHost(host)) {
        witnesses.push(`isBlockedApplyScanHost("${host}") -> false`)
      }
    }
    const counterexample = await runProperty(
      fc.tuple(httpScheme, blockedHost, path),
      async ([scheme, host, tail]) =>
        (await badUrlProblems(urlOf(scheme, "", host, "", tail))).length === 0
    )
    const problem = report(
      "bare",
      tuples.length,
      sweepProblems,
      witnesses,
      counterexample
    )
    if (problem) throw new Error(problem)
  }, 60_000)

  it("no non-http(s) scheme reaches fetch", async () => {
    const tuples = grid(
      OTHER_SCHEMES,
      [...BLOCKED_HOSTS, ...PUBLIC_HOSTS],
      anyShape
    )
    const sweepProblems = await sweepBad(tuples)
    const witnesses: string[] = []
    const counterexample = await runProperty(
      fc.tuple(
        otherScheme,
        userinfo,
        fc.oneof(blockedHost, publicHost),
        port,
        path
      ),
      async ([scheme, user, host, p, tail]) =>
        (await badUrlProblems(urlOf(scheme, user, host, p, tail))).length === 0
    )
    const problem = report(
      "scheme",
      tuples.length,
      sweepProblems,
      witnesses,
      counterexample
    )
    if (problem) throw new Error(problem)
  }, 60_000)
})
