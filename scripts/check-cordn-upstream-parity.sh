#!/usr/bin/env bash
set -euo pipefail

upstream_url="${CORDN_UPSTREAM_URL:-https://github.com/Cordn-msg/cordn.git}"
upstream_ref="${CORDN_UPSTREAM_REF:-master}"
workdir="$(mktemp -d /tmp/cordn-upstream-parity-XXXXXX)"

cleanup() {
  if command -v gio >/dev/null 2>&1; then
    gio trash "$workdir" >/dev/null 2>&1 || true
    return
  fi

  printf 'Temporary upstream checkout remains at %s\n' "$workdir" >&2
}
trap cleanup EXIT

git clone --depth=1 --filter=blob:none --sparse --branch "$upstream_ref" "$upstream_url" "$workdir" >/dev/null
git -C "$workdir" sparse-checkout set src/server src/contracts >/dev/null
upstream_commit="$(git -C "$workdir" rev-parse HEAD)"

node --input-type=module - "$workdir" "$upstream_commit" <<'NODE'
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const upstreamDir = process.argv[2];
const upstreamCommit = process.argv[3];
const upstreamSource = readFileSync(`${upstreamDir}/src/server/coordinatorMethods.ts`, "utf8");
const browserContracts = readFileSync("src/cordn/contracts/index.ts", "utf8");

const upstreamKeys = [
  ...new Set(
    [...upstreamSource.matchAll(/COORDINATOR_METHODS\.([A-Za-z0-9_]+)/g)]
      .map((match) => match[1])
      .filter(Boolean),
  ),
].sort();

const browserMethodsObject = browserContracts.match(
  /export const COORDINATOR_METHODS = \{([\s\S]*?)\} as const;/,
)?.[1];

if (!browserMethodsObject) {
  throw new Error("Could not find browser COORDINATOR_METHODS export");
}

const browserKeys = [...browserMethodsObject.matchAll(/\s*([A-Za-z0-9_]+):\s*"[^"]+"/g)]
  .map((match) => match[1])
  .filter(Boolean)
  .sort();

const missingInBrowser = upstreamKeys.filter((key) => !browserKeys.includes(key));
const extraInBrowser = browserKeys.filter((key) => !upstreamKeys.includes(key));

if (missingInBrowser.length > 0 || extraInBrowser.length > 0) {
  process.stderr.write("Cordn server method parity failed\n");
  process.stderr.write(`${JSON.stringify({ missingInBrowser, extraInBrowser }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(
  `Cordn server method parity passed: ${browserKeys.length} methods match ${upstreamCommit} at ${relative(process.cwd(), upstreamDir)}\n`,
);
NODE
