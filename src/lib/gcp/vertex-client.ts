import { VertexAI } from "@google-cloud/vertexai";
import { GCP_CONFIG } from "../config";

let vertexAI: VertexAI | null = null;

export function getVertexAI() {
  if (!vertexAI) {
    vertexAI = new VertexAI({
      project: GCP_CONFIG.projectId,
      location: GCP_CONFIG.region,
    });
  }
  return vertexAI;
}

export function getGenerativeModel(
  modelName: string = GCP_CONFIG.vertexModel,
  isJson: boolean = false
) {
  const vertex = getVertexAI();
  return vertex.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: isJson ? "application/json" : "text/plain",
    },
  });
}

/**
 * Robust live Vertex AI content generator that queries Gemini Flash-Lite live.
 */
export async function generateVertexContent(prompt: string, isJson: boolean = true): Promise<string> {
  const vertex = getVertexAI();
  const candidateModels = Array.from(
    new Set([GCP_CONFIG.vertexModel, "gemini-2.5-flash", "gemini-2.5-flash-lite"])
  );

  for (const modelName of candidateModels) {
    try {
      const model = vertex.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: isJson ? "application/json" : "text/plain",
        },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) {
        return text;
      }
    } catch (e: any) {
      // Try next supported model endpoint
    }
  }

  throw new Error("Vertex AI Gemini model endpoint failed to generate content.");
}

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
}

/**
 * Generate content grounded in live Google Search results.
 *
 * This exists because the demo needs *real* community sentiment, and the
 * obvious route — scraping Reddit — is not viable: the unauthenticated JSON
 * endpoints are blocked outright, the RSS feeds carry no scores or comments
 * and rate-limit aggressively, and the official API classes sales-demo usage
 * as commercial use requiring a paid agreement. Search grounding gets us real,
 * citable discussion through a Google product with no third-party credentials.
 *
 * Deliberately NOT tolerant of failure. Callers must surface an outage to the
 * user rather than substituting invented content — a fabricated "community
 * insight" is worse than a visible error, because nobody can tell it is fake.
 *
 * Note: `responseMimeType: "application/json"` is not combined with the search
 * tool here. Structure the output in a second, ungrounded pass instead.
 */
export async function generateGroundedContent(prompt: string): Promise<GroundedResult> {
  const vertex = getVertexAI();
  const candidateModels = Array.from(
    new Set([GCP_CONFIG.vertexGroundedModel, "gemini-2.5-flash"])
  );

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const model = vertex.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        tools: [{ googleSearch: {} } as any],
      });

      const result = await model.generateContent(prompt);
      const candidate = result.response.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
      if (!text) {
        lastError = new Error(`Model ${modelName} returned empty grounded text.`);
        continue;
      }

      const meta: any = candidate?.groundingMetadata;
      const seen = new Set<string>();
      const citations: GroundingCitation[] = [];

      for (const chunk of (meta?.groundingChunks || []) as any[]) {
        const web = chunk?.web;
        if (!web?.uri) continue;
        if (seen.has(web.uri)) continue;
        seen.add(web.uri);
        citations.push({
          title: web.title || web.domain || "Source",
          uri: web.uri,
          domain: web.domain || web.title || "",
        });
      }

      // If Search ran but surfaced nothing, the "grounded" label would be a
      // lie. Treat it the same as a failure.
      if (citations.length === 0) {
        lastError = new Error(`Model ${modelName} produced no grounding citations.`);
        continue;
      }

      return {
        text,
        citations,
        searchQueries: (meta?.webSearchQueries || []) as string[],
        modelUsed: modelName,
      };
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(
    `Google Search grounding unavailable: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * Parse JSON out of a model response.
 *
 * Even with `responseMimeType: "application/json"` set, models intermittently
 * wrap output in a ```json fence or prepend a sentence. Calling `JSON.parse`
 * directly on the raw text throws in those cases, which used to push callers
 * into their hardcoded fallback content without any visible error — the demo
 * would look like it was working while showing canned data.
 *
 * Returns `null` rather than throwing so callers can decide what to do.
 */
export function parseModelJson<T = any>(raw: string): T | null {
  if (!raw) return null;

  let text = raw.trim();

  // Strip a leading ```json / ``` fence and its closing counterpart.
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall back to the outermost balanced object or array in the response.
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
