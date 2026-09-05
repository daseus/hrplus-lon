#!/usr/bin/env node
// Plattformsoberoende bygge för Cloudflare Pages.
// Användning: node build.mjs [utdatakatalog]   (standard: dist)

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || "dist";
const dist = resolve(root, outDir);
const relativeDist = relative(root, dist);

if (!relativeDist || relativeDist.startsWith("..") || isAbsolute(relativeDist)) {
  throw new Error("Utdatakatalogen måste vara en separat mapp inuti projektmappen.");
}

const sourceIndex = join(root, "index.html");
const sourceApp = join(root, "src", "app.js");
const sourceStyles = join(root, "src", "styles.css");
const sourceLogic = join(root, "src", "logic");
const sourceVendor = join(root, "vendor", "xlsx.full.min.js");
const sourceNoticeFile = join(root, "source-notice.html");

for (const required of [sourceIndex, sourceApp, sourceStyles, sourceLogic, sourceVendor]) {
  if (!existsSync(required)) throw new Error(`Saknar ${relative(root, required)}.`);
}

function shortHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function readText(path) {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "vendor"), { recursive: true });
mkdirSync(join(dist, "assets", "logic"), { recursive: true });

const sourceNotice = existsSync(sourceNoticeFile)
  ? readText(sourceNoticeFile)
  : "<!-- Lönefiler behandlas lokalt i webbläsaren och laddas inte upp. -->";
const css = readText(sourceStyles);
const vendor = readFileSync(sourceVendor);
const cssVersion = shortHash(css);
const vendorVersion = shortHash(vendor);

const logicSources = new Map(
  readdirSync(sourceLogic)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => [file, readText(join(sourceLogic, file))])
);
const logicVersion = shortHash(
  Array.from(logicSources, ([file, content]) => `${file}\0${content}`).join("\0")
);
for (const [file, source] of logicSources) {
  let content = source;
  for (const dependency of logicSources.keys()) {
    content = content.replaceAll(`./${dependency}`, `./${dependency}?v=${logicVersion}`);
  }
  writeFileSync(join(dist, "assets", "logic", file), content, "utf8");
}

let app = readText(sourceApp);
for (const file of logicSources.keys()) {
  app = app.replaceAll(`./logic/${file}`, `./logic/${file}?v=${logicVersion}`);
}
app = app.replaceAll("vendor/xlsx.full.min.js", `vendor/xlsx.full.min.js?v=${vendorVersion}`);
const appVersion = shortHash(app);

writeFileSync(join(dist, "assets", "app.css"), css, "utf8");
writeFileSync(join(dist, "assets", "app.js"), app, "utf8");
copyFileSync(sourceVendor, join(dist, "vendor", "xlsx.full.min.js"));

let html = readText(sourceIndex);
html = html.replace(/^<!doctype html>/i, (doctype) => `${doctype}\n${sourceNotice}`);
html = html.replace('href="assets/app.css"', `href="assets/app.css?v=${cssVersion}"`);
html = html.replace('src="assets/app.js"', `src="assets/app.js?v=${appVersion}"`);
writeFileSync(join(dist, "index.html"), html, "utf8");

const versionMatch = app.match(/const APP_INFO\s*=\s*\{[\s\S]*?version:\s*"([^"]+)"/);
if (!versionMatch) throw new Error("Kunde inte hitta APP_INFO.version i src/app.js.");
writeFileSync(
  join(dist, "version.json"),
  `${JSON.stringify({ version: versionMatch[1], build: appVersion }, null, 2)}\n`,
  "utf8"
);

const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'

/
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/version.json
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/vendor/*
  Cache-Control: public, max-age=31536000, immutable
`;
writeFileSync(join(dist, "_headers"), headers, "utf8");

console.log(`Skapade ${dist}`);
console.log(`Version ${versionMatch[1]}, app-hash ${appVersion}`);
console.log(`Publicera den här mappen i Cloudflare: ${outDir}`);
