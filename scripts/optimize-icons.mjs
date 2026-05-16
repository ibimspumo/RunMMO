// Resized alle generierten Skill-Icons auf max 256px (Edge), behält PNG-
// Transparenz. Nutzt sips (auf macOS gebündelt) — auf Windows/Linux müsste
// man stattdessen sharp/imagemagick verwenden.
//
// Nutzung: node scripts/optimize-icons.mjs [--size 256]

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "src/assets/defaults/graphics/skills");

const args = process.argv.slice(2);
const sizeIdx = args.indexOf("--size");
const TARGET = sizeIdx >= 0 ? parseInt(args[sizeIdx + 1], 10) : 256;

if (!fs.existsSync(DIR)) {
  console.error(`Skill-Icon-Ordner fehlt: ${DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => /^skill_.+\.png$/i.test(f))
  .map((f) => path.join(DIR, f));

if (files.length === 0) {
  console.log("Keine Icons zum Optimieren gefunden.");
  process.exit(0);
}

console.log(`Optimiere ${files.length} Icons auf ${TARGET}px (sips)…`);

let totalBefore = 0;
let totalAfter = 0;
let errors = 0;

for (const file of files) {
  try {
    const before = fs.statSync(file).size;
    totalBefore += before;
    await execFileP("sips", ["-Z", String(TARGET), file], { timeout: 30_000 });
    const after = fs.statSync(file).size;
    totalAfter += after;
    const pct = ((1 - after / before) * 100).toFixed(0);
    console.log(
      `  ${path.basename(file)}: ${(before / 1024).toFixed(0)}kB → ${(
        after / 1024
      ).toFixed(0)}kB (−${pct}%)`,
    );
  } catch (e) {
    errors++;
    console.error(`  ${path.basename(file)} ✗ ${e.message}`);
  }
}

console.log(
  `\nFertig. Gesamt: ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(
    totalAfter /
    1024 /
    1024
  ).toFixed(1)}MB (−${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%). Fehler: ${errors}.`,
);
