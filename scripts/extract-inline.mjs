#!/usr/bin/env node
/**
 * One-off helper: extract the inline <script> body from a partial EJS into
 * public/js/<name>.js and replace it with a deferred script tag.
 * Handles CRLF and LF line endings.
 * Usage: node scripts/extract-inline.mjs <partial-name> [jsName]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [partialName, jsName] = process.argv.slice(2);
if (!partialName) {
  console.error("usage: node scripts/extract-inline.mjs <partial-name> [jsName]");
  process.exit(1);
}
const outName = jsName || partialName.replace("-content", "").replace("-icon", "");
const ejsPath = `src/views/partials/${partialName}.ejs`;
const jsPath = `public/js/${outName}.js`;

const src = readFileSync(ejsPath, "utf8");

const openMatch = src.match(/\r?\n<script>\r?\n/);
if (!openMatch) {
  console.error("no inline <script> block found");
  process.exit(1);
}
const open = openMatch.index;
const bodyStart = open + openMatch[0].length;
const closeMatch = src.match(/\r?\n<\/script>/);
// find the closing tag AFTER the body start
const closeRel = src.slice(bodyStart).search(/\r?\n<\/script>/);
if (closeRel === -1) {
  console.error("no closing </script> found");
  process.exit(1);
}
const close = bodyStart + closeRel;
const closeTagMatch = src.slice(close).match(/\r?\n<\/script>/);

let body = src.slice(bodyStart, close);
body = body.replace(/^(\r?\n)+/, "").replace(/(\r?\n\s*)+$/, "\n");

mkdirSync("public/js", { recursive: true });
writeFileSync(jsPath, body);

const replaced =
  src.slice(0, open) +
  `\n<script defer src="/js/${outName}.js"></script>\n` +
  src.slice(close + closeTagMatch[0].length);
writeFileSync(ejsPath, replaced);

console.log(`extracted ${body.length} bytes -> ${jsPath}`);
