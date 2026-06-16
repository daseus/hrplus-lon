#!/usr/bin/env node
// Plattformsoberoende bygge. Motsvarar build.ps1 men kräver bara Node.
// Användning: node build.mjs [utdatakatalog]   (standard: dist)

import { readFileSync, writeFileSync, rmSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || "dist";
const dist = resolve(root, outDir);

if (!dist.startsWith(resolve(root))) {
  throw new Error("Utdatakatalogen måste ligga inuti projektmappen.");
}

const sourceIndex = join(root, "index.html");
const sourceVendor = join(root, "vendor", "xlsx.full.min.js");
const sourceNoticeFile = join(root, "source-notice.html");

if (!existsSync(sourceIndex)) throw new Error("Saknar index.html.");
if (!existsSync(sourceVendor)) throw new Error("Saknar vendor/xlsx.full.min.js.");

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "vendor"), { recursive: true });
mkdirSync(join(dist, "assets", "logic"), { recursive: true });

const sourceNotice = existsSync(sourceNoticeFile)
  ? readFileSync(sourceNoticeFile, "utf8")
  : "<!-- Lönefiler behandlas lokalt i webbläsaren och laddas inte upp. -->";

let html = readFileSync(sourceIndex, "utf8");
html = html.replace(/^<!doctype html>/i, (m) => `${m}\n${sourceNotice}`);
writeFileSync(join(dist, "index.html"), html, "utf8");

// Kopiera assets
copyFileSync(join(root, "src", "styles.css"), join(dist, "assets", "app.css"));
copyFileSync(join(root, "src", "app.js"), join(dist, "assets", "app.js"));

// Kopiera logikmoduler
const logicFiles = readdirSync(join(root, "src", "logic"));
for (const file of logicFiles) {
  copyFileSync(join(root, "src", "logic", file), join(dist, "assets", "logic", file));
}

// Kopiera vendor
copyFileSync(sourceVendor, join(dist, "vendor", "xlsx.full.min.js"));

const headers = `/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
writeFileSync(join(dist, "_headers"), headers, "utf8");

// version.json: repo/branch/commit för den körda imagen. Tas från env (sätts av
// Docker/CI) eller faller tillbaka till lokal git. Saknas allt blir fälten tomma.
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
function normalizeRepo(url) {
  if (!url) return "";
  const ssh = url.trim().match(/git@github\.com:(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}`;
  return url.trim().replace(/\.git$/, "");
}
const repo = normalizeRepo(process.env.REPO || git("config --get remote.origin.url"));
const branch = process.env.BRANCH || git("rev-parse --abbrev-ref HEAD");
const commitFull = process.env.COMMIT_FULL || git("rev-parse HEAD");
const commit = process.env.COMMIT || (commitFull ? commitFull.slice(0, 7) : git("rev-parse --short HEAD"));
const builtAt = process.env.BUILT_AT || new Date().toISOString().replace(/\.\d+Z$/, "Z");
const commitUrl = repo && (commitFull || commit) ? `${repo}/commit/${commitFull || commit}` : "";
writeFileSync(join(dist, "version.json"),
  JSON.stringify({ repo, branch, commit, commitFull, commitUrl, builtAt }, null, 2) + "\n", "utf8");

console.log(`Skapade ${dist}`);
console.log(`Publicera den här mappen i Cloudflare: ${outDir}`);
