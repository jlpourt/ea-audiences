/**
 * 2K Courtside — verified Google model registry.
 *
 * Single source of truth for every model id the app calls. Each entry here was
 * live-tested in the `jamie-bq-test` project (see `scripts/smoke_models.mjs`
 * and `/api/health/models`). Do not add ids that have not been exercised live;
 * a model that renders a badge in the UI must actually be the model that
 * produced the output.
 *
 * Per-role overrides come from `process.env.MODEL_<ROLE>` (e.g.
 * `MODEL_REASONING=gemini-3.1-pro-preview`). Overrides change the id only —
 * the location stays with the role, since global vs. regional routing is a
 * property of the model family, not the deployment.
 */

export type ModelRole =
  | "REASONING"
  | "FAST"
  | "LITE"
  | "GROUNDED"
  | "IMAGE"
  | "TTS"
  | "MUSIC"
  | "EMBED";

export type ModelLocation = "global" | "us-central1";

export type ModelFamily =
  | "gemini-3-pro"
  | "gemini-flash"
  | "gemini-flash-lite"
  | "gemini-image"
  | "gemini-tts"
  | "lyria"
  | "gemini-embedding";

export interface ModelSpec {
  /** Vertex AI publisher model id, e.g. `gemini-3.5-flash`. */
  readonly id: string;
  /** Vertex AI location the model is served from. */
  readonly location: ModelLocation;
  /** Human label for the model badge in the UI. */
  readonly label: string;
  /** Coarse family bucket for icons / grouping. */
  readonly family: ModelFamily;
}

function withEnvOverride(role: ModelRole, spec: ModelSpec): ModelSpec {
  const override = process.env[`MODEL_${role}`];
  if (!override) return spec;
  return { ...spec, id: override, label: humanizeModelId(override) };
}

/**
 * Verified registry (Codex §6). Locations:
 *  - `global`      → host `aiplatform.googleapis.com`, path `/locations/global/...`
 *  - `us-central1` → host `us-central1-aiplatform.googleapis.com`
 */
export const MODELS: Readonly<Record<ModelRole, ModelSpec>> = {
  REASONING: withEnvOverride("REASONING", {
    id: "gemini-3.1-pro-preview",
    location: "global",
    label: "Gemini 3.1 Pro",
    family: "gemini-3-pro",
  }),
  FAST: withEnvOverride("FAST", {
    id: "gemini-3.5-flash",
    location: "global",
    label: "Gemini 3.5 Flash",
    family: "gemini-flash",
  }),
  LITE: withEnvOverride("LITE", {
    id: "gemini-3.5-flash-lite",
    location: "global",
    label: "Gemini 3.5 Flash-Lite",
    family: "gemini-flash-lite",
  }),
  // Verified 2026-10-02: gemini-3.5-flash (global) accepts the `googleSearch`
  // tool and returns groundingChunks, so grounding runs on the same fast tier
  // as NL→GQL instead of dropping back to 2.5.
  GROUNDED: withEnvOverride("GROUNDED", {
    id: "gemini-3.5-flash",
    location: "global",
    label: "Gemini 3.5 Flash · Search",
    family: "gemini-flash",
  }),
  IMAGE: withEnvOverride("IMAGE", {
    id: "gemini-2.5-flash-image",
    location: "us-central1",
    label: "Gemini 2.5 Flash Image",
    family: "gemini-image",
  }),
  TTS: withEnvOverride("TTS", {
    id: "gemini-3.1-flash-tts-preview",
    location: "us-central1",
    label: "Gemini 3.1 Flash TTS",
    family: "gemini-tts",
  }),
  MUSIC: withEnvOverride("MUSIC", {
    id: "lyria-002",
    location: "us-central1",
    label: "Lyria 2",
    family: "lyria",
  }),
  EMBED: withEnvOverride("EMBED", {
    id: "gemini-embedding-001",
    location: "us-central1",
    label: "Gemini Embedding",
    family: "gemini-embedding",
  }),
};

/** Output dimensionality of `MODELS.EMBED`. */
export const EMBED_DIMENSIONS = 3072;

/** Ordered fallback chain used by `generateText` when a text model is 404/403. */
export const TEXT_FALLBACK_CHAIN: readonly ModelRole[] = ["REASONING", "FAST", "LITE"];

/**
 * `gemini-3.1-pro-preview` → `Gemini 3.1 Pro`, `lyria-002` → `Lyria 2`,
 * `gemini-2.5-flash-image` → `Gemini 2.5 Flash Image`.
 */
export function humanizeModelId(id: string): string {
  const known = Object.values(MODELS).find((m) => m.id === id);
  if (known) return known.label;

  const lyria = id.match(/^lyria-0*(\d+)$/i);
  if (lyria) return `Lyria ${lyria[1]}`;

  return id
    .replace(/-preview$/i, "")
    .split("-")
    .map((part) => {
      if (/^\d+(\.\d+)?$/.test(part)) return part;
      if (part.toLowerCase() === "tts") return "TTS";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/** Resolve a role or a raw id to a spec; raw ids default to `us-central1`. */
export function resolveModel(roleOrId: ModelRole | string): ModelSpec {
  if (roleOrId in MODELS) return MODELS[roleOrId as ModelRole];
  const known = Object.values(MODELS).find((m) => m.id === roleOrId);
  if (known) return known;
  return {
    id: roleOrId,
    location: "us-central1",
    label: humanizeModelId(roleOrId),
    family: roleOrId.includes("lite")
      ? "gemini-flash-lite"
      : roleOrId.includes("pro")
        ? "gemini-3-pro"
        : "gemini-flash",
  };
}
