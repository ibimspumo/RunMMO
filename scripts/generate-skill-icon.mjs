// One-shot Icon-Generator via OpenRouter (Gemini 2.5 Flash Image / Nano Banana).
// Nutzung: node scripts/generate-skill-icon.mjs [output-pfad] [prompt-key]
// Erfordert OPENROUTER_API_KEY in der Umgebung oder in .env.
//
// Wird NUR in der Entwicklung benutzt — kein Bundling in den Tauri-Build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env minimal laden (kein dotenv-Dep)
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

const PROMPTS = {
  heal: `A single video game skill icon for "Healing" on a fully transparent background.
Style: Stylized MMORPG inventory icon, painterly with soft cel-shading, vibrant emerald-green color palette with hints of golden light.
Subject: A glowing green healing potion in a small round glass flask with a cork stopper, radiating a soft halo of light and a few floating green sparkles around it. The liquid swirls visibly inside.
Composition: Centered, fills ~80% of the square frame, no border, no text, no UI chrome, no shadow plate beneath. Clear edge silhouette so it reads at small sizes (64px).
Output: square aspect ratio, transparent background (no checkerboard, no white), high contrast, crisp edges.`,
};

const outputArg = process.argv[2] || "src/assets/defaults/graphics/skill_heal.png";
const promptKey = process.argv[3] || "heal";
const prompt = PROMPTS[promptKey];
if (!prompt) {
  console.error(`Unbekannter Prompt-Key: ${promptKey}. Bekannt: ${Object.keys(PROMPTS).join(", ")}`);
  process.exit(1);
}

const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(ROOT, outputArg);

console.log(`Generiere Icon: ${promptKey}`);
console.log(`Ziel: ${outputPath}`);

const body = {
  model: process.env.IMAGE_MODEL || "openai/gpt-5-image",
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
  modalities: ["image", "text"],
};

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/local/runmmo",
    "X-Title": "RunMMO Icon Gen",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`OpenRouter-Fehler ${res.status}: ${text}`);
  process.exit(1);
}

const data = await res.json();
const msg = data?.choices?.[0]?.message;
const images = msg?.images;

if (!images || images.length === 0) {
  console.error("Keine Bilder in der Antwort.");
  console.error("Antwort:", JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

const imageUrl = images[0]?.image_url?.url || images[0]?.url;
if (!imageUrl) {
  console.error("Bild-URL nicht im erwarteten Format.");
  console.error(JSON.stringify(images, null, 2).slice(0, 2000));
  process.exit(1);
}

// Data-URL: "data:image/png;base64,..."
const m = imageUrl.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
let buf;
if (m) {
  buf = Buffer.from(m[2], "base64");
} else {
  // Fallback: regulärer URL → herunterladen
  const r = await fetch(imageUrl);
  if (!r.ok) {
    console.error(`Image fetch fehlgeschlagen: ${r.status}`);
    process.exit(1);
  }
  buf = Buffer.from(await r.arrayBuffer());
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buf);

console.log(`✓ Gespeichert: ${outputPath} (${buf.length} bytes)`);
