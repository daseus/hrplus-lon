#!/usr/bin/env node
// Plattformsoberoende bygge. Motsvarar build.ps1 men kräver bara Node.
// Användning: node build.mjs [utdatakatalog]   (standard: dist)

import { readFileSync, writeFileSync, rmSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
mkdirSync(join(dist, "assets"), { recursive: true });

const sourceNotice = existsSync(sourceNoticeFile)
  ? readFileSync(sourceNoticeFile, "utf8")
  : "<!-- Lönefiler behandlas lokalt i webbläsaren och laddas inte upp. -->";

let html = readFileSync(sourceIndex, "utf8");
html = html.replace(/^<!doctype html>/i, (m) => `${m}\n${sourceNotice}`);

const styleMatch = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (styleMatch) {
  writeFileSync(join(dist, "assets", "app.css"), styleMatch[1].trim(), "utf8");
  html = html.replace(styleMatch[0], '<link rel="stylesheet" href="assets/app.css">');
}

const scriptMatch = html.match(/<script>\s*(const APP_INFO[\s\S]*?)\s*<\/script>/);
if (scriptMatch) {
  writeFileSync(join(dist, "assets", "app.js"), scriptMatch[1].trim(), "utf8");
  html = html.replace(scriptMatch[0], '<script src="assets/app.js"></script>');
}

html = html.replace(/(\r?\n){3,}/g, "\n\n");

writeFileSync(join(dist, "index.html"), html, "utf8");
copyFileSync(sourceVendor, join(dist, "vendor", "xlsx.full.min.js"));

const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'
`;
writeFileSync(join(dist, "_headers"), headers, "utf8");

console.log(`Skapade ${dist}`);
console.log(`Publicera den här mappen i Cloudflare: ${outDir}`);
