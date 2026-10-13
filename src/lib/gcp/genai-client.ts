/**
 * 2K Courtside — server-side Google GenAI client.
 *
 * One `@google/genai` client per Vertex location (`global`, `us-central1`),
 * ADC auth, no API keys. Every helper returns `modelUsed` so routes can emit
 * `model_used` and the UI can render a truthful model badge.
 *
 * Failure policy (Codex §8 + "no fakes"): errors propagate. The only
 * automatic recovery is (a) one retry with jitter on 429/503 and (b) a
 * REASONING → FAST → LITE step-down when the *requested* model itself is
 * unavailable (404/403). Content errors, safety blocks, and empty responses
 * are never papered over with canned output.
 */
import dns from "node:dns";
import {
  GoogleGenAI,
  type Candidate,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import { GoogleAuth } from "google-auth-library";

// Force IPv4-first DNS resolution so Node 22 on macOS never hangs on broken IPv6 routes to oauth2.googleapis.com
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore in edge environments
}
import { GCP_CONFIG } from "../config";
import {
  EMBED_DIMENSIONS,
  MODELS,
  TEXT_FALLBACK_CHAIN,
  resolveModel,
  type ModelLocation,
  type ModelRole,
  type ModelSpec,
} from "../models";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const clients = new Map<ModelLocation, GoogleGenAI>();

export function getGenAI(location: ModelLocation): GoogleGenAI {
  let client = clients.get(location);
  if (!client) {
    client = new GoogleGenAI({ vertexai: true, project: GCP_CONFIG.projectId, location });
    clients.set(location, client);
  }
  return client;
}

let auth: GoogleAuth | null = null;
async function getAccessToken(): Promise<string> {
  if (!auth) auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("ADC returned no access token.");
  return token;
}

function vertexHost(location: ModelLocation): string {
  return location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;
}

function modelPath(spec: ModelSpec): string {
  return `${vertexHost(spec.location)}/v1/projects/${GCP_CONFIG.projectId}/locations/${spec.location}/publishers/google/models/${spec.id}`;
}

// ---------------------------------------------------------------------------
// Errors + retry
// ---------------------------------------------------------------------------

export class GenAIError extends Error {
  constructor(
    message: string,
    public readonly status: number | undefined,
    public readonly modelId: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GenAIError";
  }
}

function statusOf(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const anyErr = e as { status?: unknown; code?: unknown; message?: unknown };
  if (typeof anyErr.status === "number") return anyErr.status;
  if (typeof anyErr.code === "number") return anyErr.code;
  const msg = typeof anyErr.message === "string" ? anyErr.message : "";
  const m = msg.match(/\b(400|401|403|404|429|500|503)\b/);
  return m ? Number(m[1]) : undefined;
}

const RETRYABLE = new Set([429, 503]);
const UNAVAILABLE = new Set([403, 404]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /ETIMEDOUT|ECONNRESET|EAI_AGAIN|oauth2\.googleapis\.com\/token|fetch failed/i.test(msg);
}

async function withRetry<T>(modelId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const status = statusOf(e);
    if ((status !== undefined && RETRYABLE.has(status)) || isTransientNetworkError(e)) {
      await sleep(350 + Math.random() * 500);
      try {
        return await fn();
      } catch (e2) {
        throw new GenAIError(
          `Model ${modelId} still unavailable after retry (${statusOf(e2) ?? "network"}).`,
          statusOf(e2),
          modelId,
          e2
        );
      }
    }
    throw new GenAIError(
      e instanceof Error ? e.message : String(e),
      status,
      modelId,
      e
    );
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export interface Usage {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
}

function usageOf(res: GenerateContentResponse | undefined): Usage {
  const u = res?.usageMetadata;
  return {
    promptTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
    thoughtTokens: u?.thoughtsTokenCount ?? 0,
    totalTokens: u?.totalTokenCount ?? 0,
  };
}

/**
 * Strip a ```json fence. Even with `responseMimeType: "application/json"`
 * models intermittently fence their output; a raw `JSON.parse` would throw
 * and push callers toward canned data, which is the one thing we never want.
 */
export function stripJsonFence(raw: string): string {
  const text = (raw || "").trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text;
}

/** Parse JSON out of a model response; `null` rather than throw. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseModelJson<T = any>(raw: string): T | null {
  if (!raw) return null;
  const text = stripJsonFence(raw);
  try {
    return JSON.parse(text) as T;
  } catch {
    const firstObj = text.indexOf("{");
    const firstArr = text.indexOf("[");
    const start =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
    if (start === -1) return null;
    const closer = text[start] === "{" ? "}" : "]";
    const end = text.lastIndexOf(closer);
    if (end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

function textOf(res: GenerateContentResponse): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p: Part) => typeof p.text === "string" && !p.thought)
    .map((p: Part) => p.text as string)
    .join("")
    .trim();
}

function isGemini3(id: string): boolean {
  return /^gemini-3(\.\d+)?-/i.test(id);
}

/**
 * Gemini 3.x reasons by default and bills the thinking into `maxOutputTokens`,
 * which is why a 1k budget can finish with MAX_TOKENS and no text. Callers
 * pass a numeric `thinkingBudget`; for 3.x we translate it to the nearest
 * `thinkingLevel`, for 2.5 we pass it through.
 */
function thinkingConfigFor(
  id: string,
  thinkingBudget: number | undefined
): GenerateContentConfig["thinkingConfig"] {
  if (isGemini3(id)) {
    if (thinkingBudget === undefined) return { thinkingLevel: "LOW" as never };
    if (thinkingBudget <= 0) return { thinkingLevel: "MINIMAL" as never };
    if (thinkingBudget < 2048) return { thinkingLevel: "LOW" as never };
    if (thinkingBudget < 8192) return { thinkingLevel: "MEDIUM" as never };
    return { thinkingLevel: "HIGH" as never };
  }
  if (thinkingBudget === undefined) return undefined;
  return { thinkingBudget };
}

function fallbackChainFor(spec: ModelSpec): ModelSpec[] {
  const idx = TEXT_FALLBACK_CHAIN.findIndex((role) => MODELS[role].id === spec.id);
  if (idx === -1) return [spec];
  return TEXT_FALLBACK_CHAIN.slice(idx).map((role) => MODELS[role]);
}

// ---------------------------------------------------------------------------
// generateText
// ---------------------------------------------------------------------------

export interface GenerateTextInput {
  /** A registry role (`"FAST"`) or an explicit model id. */
  role: ModelRole | string;
  prompt: string;
  system?: string;
  json?: boolean;
  /** Vertex responseSchema (OpenAPI subset). Implies `json`. */
  schema?: object;
  temperature?: number;
  maxOutputTokens?: number;
  /** Numeric budget; mapped to `thinkingLevel` on Gemini 3.x. `0` = minimal. */
  thinkingBudget?: number;
  /** Abort the underlying request. */
  signal?: AbortSignal;
}

export interface GenerateTextResult {
  text: string;
  modelUsed: string;
  latencyMs: number;
  usage: Usage;
  finishReason?: string;
}

function buildTextConfig(spec: ModelSpec, input: GenerateTextInput): GenerateContentConfig {
  const wantsJson = Boolean(input.json || input.schema);
  const config: GenerateContentConfig = {
    temperature: input.temperature ?? (wantsJson ? 0.2 : 0.7),
    maxOutputTokens: input.maxOutputTokens ?? 8192,
    thinkingConfig: thinkingConfigFor(spec.id, input.thinkingBudget),
    abortSignal: input.signal,
  };
  if (input.system) config.systemInstruction = input.system;
  if (wantsJson) {
    config.responseMimeType = "application/json";
    if (input.schema) config.responseSchema = input.schema as GenerateContentConfig["responseSchema"];
  }
  return config;
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  if (!input.prompt || typeof input.prompt !== "string") {
    throw new Error("generateText: prompt is required.");
  }
  const requested = resolveModel(input.role);
  const chain = fallbackChainFor(requested);
  let lastErr: GenAIError | null = null;

  for (const spec of chain) {
    const started = Date.now();
    try {
      const res = await withRetry(spec.id, () =>
        getGenAI(spec.location).models.generateContent({
          model: spec.id,
          contents: input.prompt,
          config: buildTextConfig(spec, input),
        })
      );
      const candidate: Candidate | undefined = res.candidates?.[0];
      let text = textOf(res);
      if (input.json || input.schema) text = stripJsonFence(text);

      if (!text) {
        const reason = candidate?.finishReason || res.promptFeedback?.blockReason || "EMPTY";
        throw new GenAIError(
          `Model ${spec.id} returned no text (finishReason=${reason}).`,
          undefined,
          spec.id
        );
      }

      return {
        text,
        modelUsed: res.modelVersion || spec.id,
        latencyMs: Date.now() - started,
        usage: usageOf(res),
        finishReason: candidate?.finishReason,
      };
    } catch (e) {
      const err = e instanceof GenAIError ? e : new GenAIError(String(e), statusOf(e), spec.id, e);
      lastErr = err;
      // Step down the chain ONLY when the model itself is unavailable.
      if (err.status !== undefined && UNAVAILABLE.has(err.status) && spec !== chain[chain.length - 1]) {
        console.warn(`[genai] ${spec.id} unavailable (${err.status}); stepping down.`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("generateText: no model available.");
}

// ---------------------------------------------------------------------------
// streamText
// ---------------------------------------------------------------------------

export interface StreamTextInput extends Omit<GenerateTextInput, "json" | "schema"> {}

/**
 * Yields text deltas as they arrive. Thought parts are filtered out so the
 * typing effect never leaks chain-of-thought into the UI.
 */
export async function* streamText(input: StreamTextInput): AsyncGenerator<string, void, void> {
  const spec = resolveModel(input.role);
  const stream = await withRetry(spec.id, () =>
    getGenAI(spec.location).models.generateContentStream({
      model: spec.id,
      contents: input.prompt,
      config: buildTextConfig(spec, { ...input, json: false }),
    })
  );
  for await (const chunk of stream) {
    const delta = textOf(chunk);
    if (delta) yield delta;
  }
}

/**
 * Wrap a delta iterator as a Server-Sent Events `Response`.
 * Events: `data: {"delta":"..."}` per chunk, then `event: done`.
 * Errors mid-stream are emitted as `event: error` with a generic message —
 * details stay in the server log.
 */
export function toSSEResponse(
  iterator: AsyncIterable<string>,
  meta?: Record<string, string | number | boolean>
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string | null, data: unknown) => {
        const head = event ? `event: ${event}\n` : "";
        controller.enqueue(encoder.encode(`${head}data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        if (meta) send("meta", meta);
        for await (const delta of iterator) send(null, { delta });
        send("done", { ok: true });
      } catch (e) {
        console.error("[genai] stream error", e);
        send("error", { message: "Model stream interrupted." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// generateImage
// ---------------------------------------------------------------------------

export type ImageAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "2:3" | "3:2";

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  /** Optional reference image (base64, no data: prefix) for edits / style. */
  referenceImageBase64?: string;
  referenceMimeType?: string;
}

export interface MediaResult {
  bytes: Buffer;
  mimeType: string;
  modelUsed: string;
  latencyMs: number;
}

export interface GenerateImageResult extends MediaResult {
  /** Any caption text the model emitted alongside the image. */
  text?: string;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const spec = MODELS.IMAGE;
  const started = Date.now();

  const parts: Part[] = [];
  if (input.referenceImageBase64) {
    parts.push({
      inlineData: {
        data: input.referenceImageBase64,
        mimeType: input.referenceMimeType || "image/png",
      },
    });
  }
  parts.push({ text: input.prompt });
  const contents: Content[] = [{ role: "user", parts }];

  const config: GenerateContentConfig = {
    responseModalities: ["IMAGE", "TEXT"],
  };
  if (input.aspectRatio) config.imageConfig = { aspectRatio: input.aspectRatio };

  const res = await withRetry(spec.id, () =>
    getGenAI(spec.location).models.generateContent({ model: spec.id, contents, config })
  );

  const outParts = res.candidates?.[0]?.content?.parts ?? [];
  const image = outParts.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    const reason = res.candidates?.[0]?.finishReason || res.promptFeedback?.blockReason || "NO_IMAGE";
    throw new GenAIError(`Image model returned no image (${reason}).`, undefined, spec.id);
  }

  return {
    bytes: Buffer.from(image.inlineData.data, "base64"),
    mimeType: image.inlineData.mimeType || "image/png",
    modelUsed: res.modelVersion || spec.id,
    latencyMs: Date.now() - started,
    text: textOf(res) || undefined,
  };
}

// ---------------------------------------------------------------------------
// synthesizeSpeech
// ---------------------------------------------------------------------------

export type TTSVoice =
  | "Kore"
  | "Puck"
  | "Charon"
  | "Fenrir"
  | "Aoede"
  | "Leda"
  | "Orus"
  | "Zephyr"
  | "Enceladus"
  | "Algieba"
  | "Sadaltager";

export interface SynthesizeSpeechInput {
  text: string;
  voice?: TTSVoice;
  /** Natural-language delivery direction, e.g. "arena PA announcer, hype". */
  style?: string;
}

const PCM_SAMPLE_RATE = 24_000;

/** Wrap raw 16-bit mono PCM in a RIFF/WAVE header. */
export function pcmToWav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseL16Rate(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/i);
  return m ? Number(m[1]) : PCM_SAMPLE_RATE;
}

export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<MediaResult> {
  if (!input.text?.trim()) throw new Error("synthesizeSpeech: text is required.");
  const spec = MODELS.TTS;
  const started = Date.now();

  const direction = input.style ? `${input.style.trim()}: ` : "";
  const res = await withRetry(spec.id, () =>
    getGenAI(spec.location).models.generateContent({
      model: spec.id,
      contents: `${direction}${input.text}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice || "Kore" } },
        },
      },
    })
  );

  const audio = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!audio?.inlineData?.data) {
    const reason = res.candidates?.[0]?.finishReason || "NO_AUDIO";
    throw new GenAIError(`TTS model returned no audio (${reason}).`, undefined, spec.id);
  }

  const raw = Buffer.from(audio.inlineData.data, "base64");
  const mime = audio.inlineData.mimeType || "";
  const bytes = /wav/i.test(mime) ? raw : pcmToWav(raw, parseL16Rate(mime));

  return {
    bytes,
    mimeType: "audio/wav",
    modelUsed: res.modelVersion || spec.id,
    latencyMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// generateMusic (Lyria via :predict REST)
// ---------------------------------------------------------------------------

export interface GenerateMusicInput {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
}

interface LyriaPrediction {
  bytesBase64Encoded?: string;
  audioContent?: string;
  mimeType?: string;
}

export async function generateMusic(input: GenerateMusicInput): Promise<MediaResult> {
  if (!input.prompt?.trim()) throw new Error("generateMusic: prompt is required.");
  const spec = MODELS.MUSIC;
  const started = Date.now();

  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.negativePrompt) instance.negative_prompt = input.negativePrompt;
  if (typeof input.seed === "number") instance.seed = input.seed;

  const call = async () => {
    const token = await getAccessToken();
    const resp = await fetch(`${modelPath(spec)}:predict`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [instance], parameters: {} }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      const err = new Error(`Lyria ${resp.status}: ${detail.slice(0, 300)}`) as Error & { status: number };
      err.status = resp.status;
      throw err;
    }
    return (await resp.json()) as { predictions?: LyriaPrediction[] };
  };

  const json = await withRetry(spec.id, call);
  const prediction = json.predictions?.[0];
  const b64 = prediction?.bytesBase64Encoded || prediction?.audioContent;
  if (!b64) throw new GenAIError("Lyria returned no audio bytes.", undefined, spec.id);

  return {
    bytes: Buffer.from(b64, "base64"),
    mimeType: prediction?.mimeType || "audio/wav",
    modelUsed: spec.id,
    latencyMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// embedText + cosine
// ---------------------------------------------------------------------------

export async function embedText(
  texts: string[],
  taskType: "SEMANTIC_SIMILARITY" | "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "CLUSTERING" = "SEMANTIC_SIMILARITY"
): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const spec = MODELS.EMBED;
  const res = await withRetry(spec.id, () =>
    getGenAI(spec.location).models.embedContent({
      model: spec.id,
      contents: texts,
      config: { taskType, outputDimensionality: EMBED_DIMENSIONS },
    })
  );
  const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length) {
    throw new GenAIError(
      `Embedding count mismatch (${vectors.length}/${texts.length}).`,
      undefined,
      spec.id
    );
  }
  return vectors;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// groundedSearch
// ---------------------------------------------------------------------------

export interface GroundingCitation {
  title: string;
  uri: string;
  domain: string;
}

export interface GroundedResult {
  text: string;
  citations: GroundingCitation[];
  searchQueries: string[];
  modelUsed: string;
  latencyMs: number;
}

export interface GroundedSearchInput {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Google-Search-grounded generation. Deliberately strict: if Search ran but
 * surfaced no citations the "grounded" badge would be a lie, so that is an
 * error. `responseMimeType: "application/json"` is not combined with the
 * search tool; structure the output in a second, ungrounded pass.
 */
export async function groundedSearch(input: GroundedSearchInput): Promise<GroundedResult> {
  const spec = MODELS.GROUNDED;
  const started = Date.now();

  const config: GenerateContentConfig = {
    tools: [{ googleSearch: {} }],
    temperature: input.temperature ?? 0.3,
    maxOutputTokens: input.maxOutputTokens ?? 8192,
    thinkingConfig: thinkingConfigFor(spec.id, 1024),
  };
  if (input.system) config.systemInstruction = input.system;

  const res = await withRetry(spec.id, () =>
    getGenAI(spec.location).models.generateContent({
      model: spec.id,
      contents: input.prompt,
      config,
    })
  );

  const candidate = res.candidates?.[0];
  const text = textOf(res);
  if (!text) {
    throw new GenAIError(
      `Grounded model returned no text (${candidate?.finishReason || "EMPTY"}).`,
      undefined,
      spec.id
    );
  }

  const meta = candidate?.groundingMetadata;
  const seen = new Set<string>();
  const citations: GroundingCitation[] = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const web = chunk.web;
    if (!web?.uri || seen.has(web.uri)) continue;
    seen.add(web.uri);
    citations.push({
      title: web.title || web.domain || "Source",
      uri: web.uri,
      domain: web.domain || web.title || "",
    });
  }
  if (citations.length === 0) {
    throw new GenAIError("Search grounding produced no citations.", undefined, spec.id);
  }

  return {
    text,
    citations,
    searchQueries: meta?.webSearchQueries ?? [],
    modelUsed: res.modelVersion || spec.id,
    latencyMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// probe (used by /api/health/models and the smoke script)
// ---------------------------------------------------------------------------

export interface ModelProbe {
  role: ModelRole;
  id: string;
  location: ModelLocation;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export async function probeTextModel(role: ModelRole, timeoutMs = 12_000): Promise<ModelProbe> {
  const spec = MODELS[role];
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await getGenAI(spec.location).models.generateContent({
      model: spec.id,
      contents: "Reply with the single word OK.",
      config: {
        maxOutputTokens: 5,
        temperature: 0,
        thinkingConfig: thinkingConfigFor(spec.id, 0),
        abortSignal: controller.signal,
      },
    });
    return { role, id: spec.id, location: spec.location, ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      role,
      id: spec.id,
      location: spec.location,
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}
