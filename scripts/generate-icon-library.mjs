// Batch-Generator für die Skill-Icon-Bibliothek.
// Liest scripts/icon-catalog.mjs und generiert via OpenRouter (gpt-5-image)
// alle fehlenden Icons. Existierende Dateien werden übersprungen.
//
// Nutzung:
//   node scripts/generate-icon-library.mjs               → alle fehlenden
//   node scripts/generate-icon-library.mjs --force       → alle, auch existierende
//   node scripts/generate-icon-library.mjs --only heal,damage   → nur Kategorien
//
// Parallelität: CONCURRENCY (default 4).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG, buildPrompt } from "./icon-catalog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "src/assets/defaults/graphics/skills");
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "4", 10);

function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error("ERROR: OPENROUTER_API_KEY nicht gesetzt.");
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const ONLY_CATS = onlyIdx >= 0 ? args[onlyIdx + 1].split(",") : null;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const todo = CATALOG.filter((e) => {
  if (ONLY_CATS && !ONLY_CATS.includes(e.category)) return false;
  const out = path.join(OUTPUT_DIR, `skill_${e.key}.png`);
  if (!FORCE && fs.existsSync(out)) return false;
  return true;
});

console.log(`Katalog: ${CATALOG.length} Icons gesamt`);
console.log(`Zu generieren: ${todo.length} (Concurrency=${CONCURRENCY})`);
if (todo.length === 0) {
  console.log("Nichts zu tun.");
  process.exit(0);
}

async function generateOne(entry) {
  const outPath = path.join(OUTPUT_DIR, `skill_${entry.key}.png`);
  const prompt = buildPrompt(entry);

  const body = {
    model: process.env.IMAGE_MODEL || "openai/gpt-5-image",
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  };

  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/local/runmmo",
      "X-Title": "RunMMO Icon Library",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const images = data?.choices?.[0]?.message?.images;
  if (!images || images.length === 0) {
    throw new Error(`Keine Bilder in Antwort: ${JSON.stringify(data).slice(0, 500)}`);
  }
  const imageUrl = images[0]?.image_url?.url || images[0]?.url;
  if (!imageUrl) throw new Error("Bild-URL nicht im erwarteten Format");

  const m = imageUrl.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
  let buf;
  if (m) {
    buf = Buffer.from(m[2], "base64");
  } else {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Image fetch ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  }
  fs.writeFileSync(outPath, buf);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  return { ok: true, key: entry.key, bytes: buf.length, dt };
}

async function runBatched() {
  const results = [];
  let cursor = 0;

  async function worker(id) {
    while (cursor < todo.length) {
      const idx = cursor++;
      const entry = todo[idx];
      const tag = `[${idx + 1}/${todo.length} W${id}] ${entry.key}`;
      console.log(`${tag} → start`);
      try {
        const r = await generateOne(entry);
        console.log(`${tag} ✓ ${r.bytes} bytes in ${r.dt}s`);
        results.push(r);
      } catch (e) {
        console.error(`${tag} ✗ ${e.message}`);
        results.push({ ok: false, key: entry.key, error: e.message });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  return results;
}

const results = await runBatched();
const ok = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\nFertig. ${ok}/${results.length} erfolgreich.`);
if (failed.length) {
  console.log(`Fehler:\n${failed.map((f) => `  ${f.key}: ${f.error}`).join("\n")}`);
}
