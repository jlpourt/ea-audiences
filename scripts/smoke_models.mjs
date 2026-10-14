#!/usr/bin/env -S npx tsx
/**
 * 2K Courtside — live model smoke test.
 *
 * Exercises every role in `src/lib/models.ts` through the real client code
 * (`src/lib/gcp/genai-client.ts`) against Vertex AI in `jamie-bq-test`, and
 * writes sample artefacts to `scripts/.smoke/` (gitignored):
 *
 *   text_fast.json   JSON-mode output from FAST (schema-constrained)
 *   text_lite.txt    plain output from LITE
 *   text_reasoning.txt  plain output from REASONING
 *   grounded.json    GROUNDED answer + citations
 *   image.png        IMAGE output
 *   tts.wav          TTS output (RIFF-wrapped PCM 24 kHz mono)
 *   music.wav        MUSIC output (Lyria)
 *   embed.json       EMBED dims + cosine between two archetypes
 *
 * Run:  npx tsx scripts/smoke_models.mjs            (all roles)
 *       npx tsx scripts/smoke_models.mjs text image (subset)
 *
 * Auth is ADC; no keys. Failures are printed and exit non-zero — this script
 * never substitutes placeholder bytes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import modelsPkg from "../src/lib/models.ts";
import genaiPkg from "../src/lib/gcp/genai-client.ts";

const { MODELS } = modelsPkg;
const {
  cosine,
  embedText,
  generateImage,
  generateMusic,
  generateText,
  generateVideo,
  groundedSearch,
  streamText,
  synthesizeSpeech,
} = genaiPkg;

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, ".smoke");
fs.mkdirSync(outDir, { recursive: true });

const requested = new Set(process.argv.slice(2));
const want = (name) => requested.size === 0 || requested.has(name);

const results = [];
let failures = 0;

async function step(name, fn) {
  const started = Date.now();
  process.stdout.write(`▶ ${name.padEnd(12)} `);
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true, ms, ...detail });
    console.log(`OK   ${String(ms).padStart(6)} ms  ${detail.summary || ""}`);
  } catch (e) {
    failures++;
    const ms = Date.now() - started;
    results.push({ name, ok: false, ms, error: String(e?.message || e) });
    console.log(`FAIL ${String(ms).padStart(6)} ms  ${String(e?.message || e).slice(0, 240)}`);
  }
}

function write(file, bytes) {
  const p = path.join(outDir, file);
  fs.writeFileSync(p, bytes);
  return { file: path.relative(process.cwd(), p), bytes: Buffer.byteLength(bytes) };
}

console.log(`\n2K Courtside · model smoke · project jamie-bq-test\n`);
for (const [role, spec] of Object.entries(MODELS)) {
  console.log(`  ${role.padEnd(10)} ${spec.id.padEnd(30)} ${spec.location}`);
}
console.log("");

if (want("text")) {
  await step("FAST json", async () => {
    const r = await generateText({
      role: "FAST",
      system: "You are the 2K Courtside audience engine. Answer only in JSON.",
      prompt:
        "Propose one retention offer for NBA 2K27 MyCAREER players under 85 OVR who have not logged in for 7 days. Fields: offer_name, price_usd, vc_amount, hook.",
      schema: {
        type: "OBJECT",
        properties: {
          offer_name: { type: "STRING" },
          price_usd: { type: "NUMBER" },
          vc_amount: { type: "INTEGER" },
          hook: { type: "STRING" },
        },
        required: ["offer_name", "price_usd", "vc_amount", "hook"],
      },
    });
    JSON.parse(r.text); // must be valid JSON
    const w = write("text_fast.json", r.text);
    return { summary: `${r.modelUsed} → ${w.file} (${w.bytes} B, ${r.usage.totalTokens} tok)`, modelUsed: r.modelUsed };
  });

  await step("LITE text", async () => {
    const r = await generateText({
      role: "LITE",
      prompt: "Write one 12-word arena ticker line hyping NBA 2K27 Season 2.",
      thinkingBudget: 0,
      maxOutputTokens: 256,
    });
    const w = write("text_lite.txt", r.text);
    return { summary: `${r.modelUsed} → "${r.text.slice(0, 60)}"`, modelUsed: r.modelUsed };
  });

  await step("REASONING", async () => {
    const r = await generateText({
      role: "REASONING",
      prompt:
        "In two sentences, why does a MyCAREER player's crew activity predict Season 2 retention better than their own OVR?",
      thinkingBudget: 1024,
      maxOutputTokens: 2048,
    });
    const w = write("text_reasoning.txt", r.text);
    return { summary: `${r.modelUsed} → ${w.file} (${r.usage.thoughtTokens} thought tok)`, modelUsed: r.modelUsed };
  });

  await step("LITE stream", async () => {
    let chunks = 0;
    let text = "";
    for await (const delta of streamText({
      role: "LITE",
      prompt: "List the MyTEAM card tiers from Emerald to Dark Matter, comma separated.",
      thinkingBudget: 0,
      maxOutputTokens: 256,
    })) {
      chunks++;
      text += delta;
    }
    if (!text) throw new Error("stream produced no text");
    return { summary: `${chunks} chunks → "${text.slice(0, 60)}"` };
  });
}

if (want("omni")) {
  await step("OMNI text", async () => {
    const r = await generateText({
      role: "OMNI",
      prompt: "Write a 10-word NBA 2K27 Season 2 Crew Courtside callout.",
    });
    const w = write("text_omni.txt", r.text);
    return { summary: `${r.modelUsed} → "${r.text.slice(0, 60)}"`, modelUsed: r.modelUsed };
  });
}

if (want("grounded")) {
  await step("GROUNDED", async () => {
    const r = await groundedSearch({
      prompt:
        "In three sentences, summarise what r/NBA2K is saying about VC pricing and pay-to-win in NBA 2K27 this month.",
    });
    const w = write("grounded.json", JSON.stringify(r, null, 2));
    return {
      summary: `${r.modelUsed} · ${r.citations.length} citations · ${r.searchQueries.length} queries → ${w.file}`,
      modelUsed: r.modelUsed,
    };
  });
}

if (want("image")) {
  await step("IMAGE", async () => {
    const r = await generateImage({
      prompt:
        "NBA 2K27 MyTEAM 'Galaxy Opal Deluxe' pack art: a holographic basketball trading-card pack, deep court-black background, iridescent opal foil, 2K red accent, studio lighting, no text.",
      aspectRatio: "3:4",
    });
    const w = write("image.png", r.bytes);
    if (w.bytes < 10_000) throw new Error(`image too small: ${w.bytes} B`);
    return { summary: `${r.modelUsed} ${r.mimeType} → ${w.file} (${w.bytes} B)`, modelUsed: r.modelUsed };
  });
}

if (want("video")) {
  await step("VIDEO", async () => {
    const r = await generateVideo({
      prompt:
        "Cinematic slow-motion basketball swishing through an illuminated neon 2K arena hoop, dark stadium lighting, 4k broadcast camera.",
      aspectRatio: "16:9",
      durationSeconds: 4,
    });
    const w = write("video.mp4", r.bytes);
    if (w.bytes < 50_000) throw new Error(`video too small: ${w.bytes} B`);
    return { summary: `${r.modelUsed} ${r.mimeType} → ${w.file} (${w.bytes} B)`, modelUsed: r.modelUsed };
  });
}

if (want("tts")) {
  await step("TTS", async () => {
    const r = await synthesizeSpeech({
      text: "Ladies and gentlemen, Season Two tips off October seventeenth. Re-up your crew. Courtside.",
      voice: "Charon",
      style: "Say it like an NBA arena PA announcer, big and energetic",
    });
    const w = write("tts.wav", r.bytes);
    if (w.bytes < 10_000) throw new Error(`wav too small: ${w.bytes} B`);
    if (r.bytes.toString("ascii", 0, 4) !== "RIFF") throw new Error("missing RIFF header");
    return { summary: `${r.modelUsed} ${r.mimeType} → ${w.file} (${w.bytes} B)`, modelUsed: r.modelUsed };
  });
}

if (want("music")) {
  await step("MUSIC", async () => {
    const r = await generateMusic({
      prompt:
        "High-energy NBA arena hype bed, 808 sub bass, crowd stomp-clap, brass stabs, 124 BPM, cinematic build, instrumental",
      negativePrompt: "vocals, lyrics",
    });
    const w = write("music.wav", r.bytes);
    if (w.bytes < 10_000) throw new Error(`wav too small: ${w.bytes} B`);
    if (r.bytes.toString("ascii", 0, 4) !== "RIFF") throw new Error("missing RIFF header");
    return { summary: `${r.modelUsed} ${r.mimeType} → ${w.file} (${w.bytes} B)`, modelUsed: r.modelUsed };
  });
}

if (want("embed")) {
  await step("EMBED", async () => {
    const [a, b, c] = await embedText([
      "MyTEAM Pack Whale: opens 40+ packs a month chasing Galaxy Opals",
      "MyTEAM collector who spends heavily on card packs",
      "Casual MyCAREER story player who never touches MyTEAM",
    ]);
    const near = cosine(a, b);
    const far = cosine(a, c);
    const w = write("embed.json", JSON.stringify({ dims: a.length, near, far }, null, 2));
    if (a.length !== 3072) throw new Error(`expected 3072 dims, got ${a.length}`);
    return { summary: `${MODELS.EMBED.id} ${a.length}d · cos(near)=${near.toFixed(3)} cos(far)=${far.toFixed(3)}` };
  });
}

console.log("\nLatency summary");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name.padEnd(12)} ${String(r.ms).padStart(6)} ms${r.modelUsed ? `  ${r.modelUsed}` : ""}`);
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(results, null, 2));
console.log(`\nArtefacts in ${path.relative(process.cwd(), outDir)}/`);
if (failures) {
  console.log(`\n${failures} role(s) FAILED`);
  process.exit(1);
}
