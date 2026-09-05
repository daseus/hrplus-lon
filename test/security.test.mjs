import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "src", "app.js"), "utf8");
const build = readFileSync(join(root, "build.mjs"), "utf8");
const nginx = readFileSync(join(root, "nginx.conf"), "utf8");

test("appen gör bara det avsedda, lokala versionsanropet", () => {
  assert.equal((app.match(/\bfetch\s*\(/g) || []).length, 1);
  assert.match(app, /fetch\(`version\.json\?check=\$\{now\}`/);

  for (const api of ["XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource"]) {
    assert.doesNotMatch(app, new RegExp(`\\b${api}\\b`));
  }

  assert.doesNotMatch(app, /https?:\/\//);
});

test("publiceringsmiljöerna begränsar anslutningar till samma ursprung", () => {
  for (const policy of [build, nginx]) {
    assert.match(policy, /connect-src 'self'/);
    assert.match(policy, /form-action 'none'/);
    assert.match(policy, /object-src 'none'/);
  }
});
