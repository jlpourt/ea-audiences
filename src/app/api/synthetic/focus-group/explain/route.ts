import { NextRequest, NextResponse } from "next/server";
import {
  generateText,
  parseModelJson,
  synthesizeMultiSpeakerSpeech,
  GenAIError,
} from "@/lib/gcp/genai-client";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

export interface ExplainFlowBeat {
  id: "r1" | "signals" | "r2" | "verdict";
  stage: "r1" | "signals" | "r2" | "verdict";
  speaker: "Analyst" | "Player";
  speakerLabel: string;
  nodeHighlight: string;
  caption: string;
  startRatio: number;
  endRatio: number;
}

interface GeneratedWalkthroughScript {
  beat1_r1_analyst: string;
  beat2_signals_analyst: string;
  beat3_r2_player: string;
  beat4_verdict_analyst: string;
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json();

    // Every fact narrated must come from the live simulation: no server-side defaults.
    const missing: string[] = [];
    const reqNum = (key: string): number => {
      const v = body?.[key];
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (!Number.isFinite(n)) missing.push(key);
      return n;
    };
    const reqStr = (key: string): string => {
      const v = body?.[key];
      if (typeof v !== "string" || v.trim() === "") {
        missing.push(key);
        return "";
      }
      return v.trim();
    };
    const optStr = (key: string): string | null => {
      const v = body?.[key];
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    };

    const creativeTitle = reqStr("creativeTitle");
    const priceUsd = reqNum("priceUsd");
    const totalAgents = reqNum("totalDenominator");
    const r1Buy = reqNum("r1Buy");
    const r1Eval = reqNum("r1Eval");
    const r1Pass = reqNum("r1Pass");
    const finalBuy = reqNum("buyCount");
    const contagionFlips = reqNum("contagionFlipsCount");
    const round3Flips = reqNum("round3FlipsCount");
    const hasRound3 = Boolean(body?.hasRound3);
    const selectedCfLabel = hasRound3 ? reqStr("selectedCfLabel") : optStr("selectedCfLabel");
    const crewMultiplier = reqNum("crewMultiplier");
    const conversionLift = reqNum("conversionLift");
    const revenue30d = reqNum("revenue30d");
    const topCreator = optStr("topCreator");
    const featuredPlayerTag = reqStr("featuredPlayerTag").replace(/^@/, "");
    const featuredPlayerR1State = reqStr("featuredPlayerR1State");
    const featuredPlayerDriver = reqStr("featuredPlayerDriver");
    const featuredPlayerQuote = reqStr("featuredPlayerQuote");
    const featuredPlayerOvrRaw = body?.featuredPlayerOvr;
    const featuredPlayerOvr =
      typeof featuredPlayerOvrRaw === "number" && Number.isFinite(featuredPlayerOvrRaw) ? featuredPlayerOvrRaw : null;
    const featuredPlayerCrew = optStr("featuredPlayerCrew");

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Explain Flow needs live simulation results; missing or invalid: ${missing.join(", ")}`,
          missing,
        },
        { status: 400 }
      );
    }

    const isFreeGift = priceUsd === 0;
    const offerLine = isFreeGift
      ? `Offer tested: "${creativeTitle}" as a FREE retention gift (players claim it and stay with their crew) across ${totalAgents} Spanner Graph player personas.`
      : `Offer tested: "${creativeTitle}" at $${priceUsd.toFixed(2)} across ${totalAgents} Spanner Graph player personas.`;
    const buyVerb = isFreeGift ? "claim it and stay" : "buy";
    const buyNoun = isFreeGift ? "players who claim and stay" : "buyers";
    const playerDesc = `${featuredPlayerOvr !== null ? `${featuredPlayerOvr} OVR` : "an NBA 2K player"}${
      featuredPlayerCrew ? ` in crew "${featuredPlayerCrew}"` : ""
    }`;
    const signalSources = topCreator
      ? `${topCreator}'s co-stream, r/NBA2K, and Rec Crew Captains`
      : "r/NBA2K and Rec Crew Captains";

    const prompt = `You are writing a ultra-crisp, human-sounding 4-beat courtside audio walkthrough for an NBA 2K27 executive marketing simulation ("MiroFish Neural Flow").
Two speakers will voice this in a single studio take:
1. "Analyst" — a sharp, charismatic NBA 2K courtside strategist (think ESPN NBA Countdown meets Apple Keynote). Warm, natural, zero jargon, speaks in punchy conversational English.
2. "Player" — @${featuredPlayerTag}, an authentic NBA 2K Rec/Park player (${playerDesc}) who started at ${featuredPlayerR1State} in Round 1 and flipped to ${isFreeGift ? "CLAIM + STAY" : "BUY"} in Round 2 because of ${featuredPlayerDriver}.

SIMULATION FACTS TO EXPLAIN:
- ${offerLine}
- Beat 1 (Layer 2 · Round 1 Alone): In isolation, ${r1Buy} of ${totalAgents} players ${buyVerb} on their own, while ${r1Eval} sit on the fence evaluating and ${r1Pass} pass.
- Beat 2 (Layer 3 · Social Contagion Signals): When the offer hits ${signalSources}, social gravity triggers a ${crewMultiplier.toFixed(1)}x squad cascade.
- Beat 3 (Layer 4 · Single Player Flip Story): Player @${featuredPlayerTag} speaks in first-person gamer voice explaining why they flipped from ${featuredPlayerR1State} to ${isFreeGift ? "claiming the gift and staying" : "BUY"} (adapt from their reaction: "${featuredPlayerQuote}").
- Beat 4 (Layer 5 · Final Verdict): ${contagionFlips} players flip to ${isFreeGift ? "claim and stay" : "BUY"}${
      hasRound3 && round3Flips > 0
        ? ` plus ${round3Flips} rescued by the ${selectedCfLabel} What-If shock`
        : ""
    }, reaching ${finalBuy} of ${totalAgents} ${buyNoun} (+${conversionLift.toFixed(1)}% lift and $${(revenue30d / 1000).toFixed(1)}K in 30-day bookings, TimesFM forecast).

RULES:
- Each beat MUST be 14 to 22 words maximum so the entire 4-beat audio plays in ~18-22 seconds.
- Write out numbers/symbols naturally for speech where helpful, or clean conversational phrasing. Do NOT include speaker prefixes inside the JSON string values.
- Return ONLY valid JSON matching:
{
  "beat1_r1_analyst": "...",
  "beat2_signals_analyst": "...",
  "beat3_r2_player": "...",
  "beat4_verdict_analyst": "..."
}`;

    const textRes = await generateText({
      role: "FAST",
      prompt,
      temperature: 0.35,
      maxOutputTokens: 512,
      json: true,
      thinkingBudget: 0,
    });

    const parsed = parseModelJson<GeneratedWalkthroughScript>(textRes.text);
    if (
      !parsed ||
      !parsed.beat1_r1_analyst ||
      !parsed.beat2_signals_analyst ||
      !parsed.beat3_r2_player ||
      !parsed.beat4_verdict_analyst
    ) {
      throw new GenAIError(
        `Failed to parse 4-beat walkthrough JSON from ${textRes.modelUsed}`,
        502,
        textRes.modelUsed
      );
    }

    const turns = [
      {
        speaker: "Analyst",
        voice: "Aoede" as const,
        text: parsed.beat1_r1_analyst.trim(),
      },
      {
        speaker: "Analyst",
        voice: "Aoede" as const,
        text: parsed.beat2_signals_analyst.trim(),
      },
      {
        speaker: "Player",
        voice: "Puck" as const,
        text: parsed.beat3_r2_player.trim(),
      },
      {
        speaker: "Analyst",
        voice: "Aoede" as const,
        text: parsed.beat4_verdict_analyst.trim(),
      },
    ];

    const ttsRes = await synthesizeMultiSpeakerSpeech({
      direction:
        "Read this NBA 2K courtside neural flow walkthrough with natural, human-like broadcast warmth. Analyst sounds like a sharp, charismatic courtside host; Player sounds like an authentic, hyped NBA 2K squadmate:",
      turns,
    });

    // Compute proportional time ratios based on character length of each beat
    const lengths = turns.map((t) => Math.max(20, t.text.length));
    const totalChars = lengths.reduce((a, b) => a + b, 0);
    let cursor = 0;
    const ratios = lengths.map((len) => {
      const startRatio = Number((cursor / totalChars).toFixed(3));
      cursor += len;
      const endRatio = Number((cursor / totalChars).toFixed(3));
      return { startRatio, endRatio };
    });

    const beats: ExplainFlowBeat[] = [
      {
        id: "r1",
        stage: "r1",
        speaker: "Analyst",
        speakerLabel: "Courtside Analyst",
        nodeHighlight: "r1",
        caption: turns[0].text,
        startRatio: ratios[0].startRatio,
        endRatio: ratios[0].endRatio,
      },
      {
        id: "signals",
        stage: "signals",
        speaker: "Analyst",
        speakerLabel: "Courtside Analyst",
        nodeHighlight: "sig_crews",
        caption: turns[1].text,
        startRatio: ratios[1].startRatio,
        endRatio: ratios[1].endRatio,
      },
      {
        id: "r2",
        stage: "r2",
        speaker: "Player",
        speakerLabel: `@${featuredPlayerTag} (${featuredPlayerOvr} OVR)`,
        nodeHighlight: "r2",
        caption: turns[2].text,
        startRatio: ratios[2].startRatio,
        endRatio: ratios[2].endRatio,
      },
      {
        id: "verdict",
        stage: "verdict",
        speaker: "Analyst",
        speakerLabel: "Courtside Analyst",
        nodeHighlight: "verdict_buy",
        caption: turns[3].text,
        startRatio: ratios[3].startRatio,
        endRatio: 1,
      },
    ];

    const audioDataUrl = `data:${ttsRes.mimeType};base64,${ttsRes.bytes.toString("base64")}`;

    return NextResponse.json({
      audioDataUrl,
      beats,
      featuredPlayerTag: `@${featuredPlayerTag}`,
      modelUsed: `${textRes.modelUsed} + ${ttsRes.modelUsed}`,
      RegistryModels: {
        text: MODELS.FAST.id,
        tts: MODELS.TTS.id,
      },
      latencyMs: Date.now() - started,
    });
  } catch (err: any) {
    console.error("[POST /api/synthetic/focus-group/explain] failed:", err);
    const status = err instanceof GenAIError && err.status ? err.status : 502;
    return NextResponse.json(
      {
        error: "Neural Flow voice walkthrough synthesis failed on Vertex AI",
        service: "Vertex AI Gemini Text + Multi-Speaker TTS",
        details: err instanceof Error ? err.message : String(err),
      },
      { status }
    );
  }
}
