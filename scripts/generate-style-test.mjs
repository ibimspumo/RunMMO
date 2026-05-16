// Generiert dasselbe Skill-Subject in mehreren Stil-Varianten zum Vergleich.
// Saves to src/assets/style-previews/heal_<style>.png.
//
// Nutzung: node scripts/generate-style-test.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error("OPENROUTER_API_KEY fehlt.");
  process.exit(1);
}

// Gemeinsames Subject — Heiltrank, exakt wie im Haupt-Katalog
const SUBJECT = `A glowing green healing potion in a round glass flask with a cork stopper, soft halo of light, a few floating green sparkles, swirling liquid inside`;

// Stil-Varianten. Jeder Prompt hat dasselbe Komposition-Frame, nur der Stil ändert sich.
const STYLES = {
  tiktok: `Style: Chunky kawaii sticker-style icon designed for TikTok / short-form video aesthetics — very rounded thick shapes, glossy plastic-like surfaces with big bright specular highlights, exaggerated cute proportions, vibrant ultra-saturated colors, soft thick outline reminiscent of friendly mobile-game stickers, playful and fun feeling, sticker-pack appeal, optimized for small punchy reads on phone screens. Composition: Centered, fills ~80% of the frame, no border, no text, no UI chrome, no shadow plate beneath. Output: square aspect ratio, transparent background (no checkerboard, no white), high contrast, crisp edges.`,

  render3d: `Style: High-quality photoreal 3D rendered game icon — physically based materials (clear refractive glass, translucent liquid, polished metal/cork), studio three-point lighting with soft falloff and rim light, subtle subsurface scattering on the glow, cinema-quality reflections and highlights, slight depth-of-field crispness on the silhouette, looks like a hero asset from a modern AAA game. Composition: Centered, fills ~80% of the frame, no border, no text, no UI chrome, no shadow plate beneath. Output: square aspect ratio, transparent background (no checkerboard, no white), crisp readable silhouette.`,

  fluent: `Style: Microsoft Fluent 3D emoji style — soft matte 3D render with very rounded organic shapes, friendly approachable cartoony proportions, gentle clean pastel-but-vibrant color palette, soft ambient lighting with subtle integrated drop shadow under elements, slightly toy-like and warm, exactly the visual language of the Microsoft Office / Windows 11 emoji set, no harsh specular reflections, smooth and tactile. Composition: Centered, fills ~80% of the frame, no border, no text, no UI chrome. Output: square aspect ratio, transparent background, friendly and recognizable.`,

  nintendo: `Style: Stylized 3D video game item render in the visual language of modern Nintendo first-party games (Legend of Zelda: Breath of the Wild / Tears of the Kingdom item pickups, Super Mario Odyssey collectibles, Splatoon gear, Animal Crossing furniture) — clean toon-shaded 3D with a subtle cel-shading band, slightly faceted low-poly geometry that still reads as smooth, chunky friendly proportions, bright saturated Nintendo color palette, soft warm rim light, gentle painterly highlights, NO harsh photoreal reflections, looks like a hero pickup that would float and spin in-game with an item glow underneath. Composition: Centered, fills ~80% of the frame, no border, no text, no UI chrome, no shadow plate beneath. Output: square aspect ratio, transparent background (no checkerboard, no white), crisp readable silhouette.`,
};

// Skip-Logic: bereits existierende Stil-Bilder werden nicht neu generiert,
// damit Folge-Runs nur die neu hinzugefügten Stile produzieren.
const SKIP_EXISTING = !process.argv.includes("--force");

const OUT_DIR = path.join(ROOT, "src/assets/style-previews");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function generate(styleKey, styleText) {
  const prompt = `A single video game skill icon for an RPG inventory on a fully transparent background.
${styleText}
Subject: ${SUBJECT}.`;

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
      "X-Title": "RunMMO Style Test",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Keine Bild-URL in Antwort");
  const m = url.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
  const buf = m ? Buffer.from(m[2], "base64") : Buffer.from(await (await fetch(url)).arrayBuffer());
  const outPath = path.join(OUT_DIR, `heal_${styleKey}.png`);
  fs.writeFileSync(outPath, buf);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  return { ok: true, styleKey, bytes: buf.length, dt, outPath };
}

const tasks = Object.entries(STYLES).map(async ([k, v]) => {
  const outPath = path.join(OUT_DIR, `heal_${k}.png`);
  if (SKIP_EXISTING && fs.existsSync(outPath)) {
    console.log(`⤳ ${k} skipped (existiert bereits)`);
    return { ok: true, styleKey: k, skipped: true };
  }
  console.log(`→ ${k} start`);
  try {
    const r = await generate(k, v);
    console.log(`✓ ${k}: ${(r.bytes / 1024).toFixed(0)}kB in ${r.dt}s → ${r.outPath}`);
    return r;
  } catch (e) {
    console.error(`✗ ${k}: ${e.message}`);
    return { ok: false, styleKey: k, error: e.message };
  }
});

const results = await Promise.all(tasks);
const ok = results.filter((r) => r.ok).length;
console.log(`\nFertig. ${ok}/${results.length} erfolgreich.`);
