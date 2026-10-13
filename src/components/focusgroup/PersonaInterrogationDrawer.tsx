"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, ArrowUp, Users, MessageSquare, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FocusGroupReaction } from "@/lib/types";
import { ArchetypeId, archetypeColor, archetypeLabel } from "@/lib/archetypes";

export interface PersonaInterrogationDrawerProps {
  persona: FocusGroupReaction | null;
  onClose: () => void;
  offerTitle: string;
  priceUsd: number;
  panelCandidates?: FocusGroupReaction[];
  counterfactualEvent?: string | null;
}

type EnrichedReaction = FocusGroupReaction & {
  myplayer_ovr?: number | null;
  myplayer_build?: string | null;
  vc_spend_90d?: number | null;
  vc_balance?: number | null;
  contagion_source_tag?: string;
  contagion_source_snippet?: string;
  round3_fsm_state?:
    | "PURCHASED"
    | "ENGAGED_FREE"
    | "EVALUATING"
    | "ABANDONED"
    | "BOYCOTT"
    | string;
  round3_quote?: string;
  round3_wtp_usd?: number;
  round3_flipped?: boolean;
};

interface ChatMessage {
  role: "user" | "persona";
  text: string;
}

interface DebateTurn {
  gamer_tag: string;
  archetype: string;
  fsm_state: string;
  wtp_usd: number;
  crew_name?: string;
  text: string;
}

interface DebateExchange {
  question: string;
  turns: DebateTurn[];
  consensus_fracture_summary: string;
}

const QUICK_QUESTIONS = [
  "Why did you land on this verdict at this price?",
  "What VC bonus or perk would make this an instant buy?",
  "How are your Rec / Pro-Am Crew mates reacting?",
  "Does this feel fair for Season 2 progression?",
];

const DEBATE_STARTER_PROMPTS = [
  "Why did Crew mates flip in Round 2 while holdouts boycotted?",
  "Is this price point fair for Season 2 progression?",
  "What single perk would get all 3 of you to lock in?",
];

function shortVerdictLabel(state?: string | null): string {
  switch (state) {
    case "PURCHASED":
    case "ENGAGED_FREE":
      return "BUY";
    case "BOYCOTT":
      return "BOYCOTT";
    case "ABANDONED":
      return "PASS";
    case "EVALUATING":
    default:
      return "EVAL";
  }
}

function verdictBadgeMeta(state?: string | null): {
  label: string;
  className: string;
} {
  switch (state) {
    case "PURCHASED":
    case "ENGAGED_FREE":
      return {
        label: "BUY",
        className: "bg-win-green/15 text-win-green border-win-green/30",
      };
    case "BOYCOTT":
      return {
        label: "BOYCOTT",
        className: "bg-loss-red/15 text-loss-red border-loss-red/30",
      };
    case "ABANDONED":
      return {
        label: "PASS",
        className: "bg-loss-red/10 text-loss-red/90 border-loss-red/25",
      };
    case "EVALUATING":
    default:
      return {
        label: "EVAL",
        className: "bg-vc-gold/15 text-vc-gold border-vc-gold/30",
      };
  }
}

function formatProvenanceSource(p: EnrichedReaction): string {
  if (p.contagion_source_tag) return p.contagion_source_tag;
  if (p.contagion_source) return p.contagion_source;
  if (p.contagion_driver === "CREATOR_STREAM") {
    return p.creator_handle || "@Agent00";
  }
  if ((p.contagion_driver as string) === "REDDIT_THREAD") {
    return "r/NBA2K";
  }
  if (p.contagion_driver === "COUNTERFACTUAL" || p.round3_flipped) {
    return "What-If";
  }
  return p.crew_name ? `@${p.crew_name.replace(/\s+/g, "")}Cap` : "@Captain";
}

export function PersonaInterrogationDrawer({
  persona,
  onClose,
  offerTitle,
  priceUsd,
  panelCandidates,
  counterfactualEvent,
}: PersonaInterrogationDrawerProps) {
  const [activeMode, setActiveMode] = useState<"single" | "panel_debate">("single");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [debateExchanges, setDebateExchanges] = useState<DebateExchange[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const p = persona as EnrichedReaction | null;

  // Reset conversation threads when switching to a different persona
  useEffect(() => {
    setMessages([]);
    setDebateExchanges([]);
    setErrorMsg(null);
    setInputQuestion("");
  }, [p?.player_id, p?.gamer_tag]);

  // Select 3 contrasting panel debaters: 1 Buyer, 1 Holdout, 1 Crew Captain
  const selectedPanel = useMemo(() => {
    if (!p) return [];
    const pool: EnrichedReaction[] =
      panelCandidates && panelCandidates.length > 0
        ? (panelCandidates as EnrichedReaction[])
        : [p];

    const usedTags = new Set<string>();
    const markUsed = (item: EnrichedReaction) => {
      if (item.gamer_tag) usedTags.add(item.gamer_tag);
      if (item.player_id) usedTags.add(item.player_id);
    };
    const isUsed = (item: EnrichedReaction) =>
      Boolean(
        (item.gamer_tag && usedTags.has(item.gamer_tag)) ||
          (item.player_id && usedTags.has(item.player_id))
      );
    const activeState = (item: EnrichedReaction) =>
      item.round3_fsm_state || item.final_fsm_state || "EVALUATING";
    const isCaptain = (item: EnrichedReaction) =>
      item.crew_role === "CAPTAIN" ||
      item.archetype === "REC_CREW_CAPTAIN" ||
      item.archetype === "PARK_REP_GRINDER";

    const pState = activeState(p);
    const pIsCap = isCaptain(p);

    let buyer: EnrichedReaction | undefined;
    let holdout: EnrichedReaction | undefined;
    let captain: EnrichedReaction | undefined;

    // Assign clicked persona to their most natural role first so they are always in the debate
    if (pIsCap) {
      captain = p;
      markUsed(p);
    } else if (pState === "PURCHASED" || pState === "ENGAGED_FREE") {
      buyer = p;
      markUsed(p);
    } else {
      holdout = p;
      markUsed(p);
    }

    if (!buyer) {
      buyer = pool.find(
        (c) => !isUsed(c) && (activeState(c) === "PURCHASED" || activeState(c) === "ENGAGED_FREE")
      );
      if (buyer) markUsed(buyer);
    }

    if (!holdout) {
      holdout =
        pool.find((c) => !isUsed(c) && activeState(c) === "BOYCOTT") ||
        pool.find((c) => !isUsed(c) && activeState(c) === "ABANDONED") ||
        pool.find((c) => !isUsed(c) && activeState(c) === "EVALUATING");
      if (holdout) markUsed(holdout);
    }

    if (!captain) {
      captain =
        pool.find((c) => !isUsed(c) && isCaptain(c)) ||
        pool.find((c) => !isUsed(c));
      if (captain) markUsed(captain);
    }

    if (!buyer) {
      buyer = pool.find((c) => !isUsed(c)) || p;
      markUsed(buyer);
    }

    if (!holdout) {
      holdout =
        [...pool]
          .filter((c) => !isUsed(c))
          .sort((a, b) => Number(a.willingness_to_pay_usd || 0) - Number(b.willingness_to_pay_usd || 0))[0] ||
        pool.find((c) => !isUsed(c)) ||
        p;
      markUsed(holdout);
    }

    if (!captain) {
      captain = pool.find((c) => !isUsed(c)) || p;
      markUsed(captain);
    }

    return [
      { roleLabel: "Buyer", agent: buyer, accent: "text-win-green border-win-green/25 bg-win-green/[0.07]" },
      { roleLabel: "Holdout", agent: holdout, accent: "text-loss-red border-loss-red/25 bg-loss-red/[0.07]" },
      { roleLabel: "Captain", agent: captain, accent: "text-vc-gold border-vc-gold/25 bg-vc-gold/[0.07]" },
    ];
  }, [p, panelCandidates]);

  const handleAskSingle = async (question: string) => {
    if (!p || !question.trim() || isLoading) return;
    const trimmed = question.trim();
    const nextHistory: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextHistory);
    setInputQuestion("");
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/synthetic/focus-group/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          persona: p,
          question: trimmed,
          history: messages,
          offer_title: offerTitle,
          price_usd: priceUsd,
          counterfactual_event: counterfactualEvent ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP ${res.status}`);
      }
      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          {
            role: "persona",
            text: data.answer,
          },
        ]);
      }
    } catch (err: any) {
      console.error("[Interrogate Error]:", err);
      setErrorMsg(err?.message || "Interrogation request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskDebate = async (question: string) => {
    if (!p || !question.trim() || isLoading) return;
    const trimmed = question.trim();
    setInputQuestion("");
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/synthetic/focus-group/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "panel_debate",
          panel_agents: selectedPanel.map((s) => s.agent),
          question: trimmed,
          offer_title: offerTitle,
          price_usd: priceUsd,
          counterfactual_event: counterfactualEvent ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP ${res.status}`);
      }
      if (Array.isArray(data.turns)) {
        setDebateExchanges((prev) => [
          ...prev,
          {
            question: trimmed,
            turns: data.turns,
            consensus_fracture_summary: String(data.consensus_fracture_summary || ""),
          },
        ]);
      }
    } catch (err: any) {
      console.error("[Panel Debate Error]:", err);
      setErrorMsg(err?.message || "Locker Room Debate request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const badgeColor = p ? archetypeColor(p.archetype) : "#E4002B";
  const r1State = p?.round1_fsm_state || p?.final_fsm_state || "EVALUATING";
  const r2State = p?.final_fsm_state || r1State;
  const r3State = p?.round3_fsm_state || null;
  const activeQuote = p?.round3_quote || p?.verbatim_quote || "";
  const activeWtp = Number(p?.round3_wtp_usd ?? p?.willingness_to_pay_usd ?? 9.99);
  const didFlip = Boolean(
    p?.contagion_flipped || p?.round3_flipped || r1State !== r2State || (r3State && r3State !== r2State)
  );
  const rescuedInR3 = Boolean(r3State && r3State === "PURCHASED" && r2State !== "PURCHASED");

  return (
    <AnimatePresence>
      {p && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Player Interrogation Drawer: ${p.gamer_tag}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm font-sans"
          onClick={onClose}
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md bg-[#141419]/95 border-l border-white/[0.08] p-5 flex flex-col justify-between shadow-2xl backdrop-blur-2xl text-chalk"
          >
            {/* Header */}
            <div className="border-b border-white/[0.08] pb-3.5 space-y-3">
              {/* Top Row: Segmented Mode Control + Close */}
              <div className="flex items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label="Interrogation mode"
                  className="inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5"
                >
                  {(
                    [
                      { id: "single", label: "1-on-1 Interview", icon: MessageSquare },
                      { id: "panel_debate", label: "3-Way Crew Debate", icon: Users },
                    ] as const
                  ).map((tab) => {
                    const active = activeMode === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveMode(tab.id)}
                        className={`relative px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight transition-colors flex items-center gap-1.5 ${
                          active ? "text-white" : "text-white/50 hover:text-white/80"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="interrogate-mode-pill"
                            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                            className="absolute inset-0 rounded-full bg-white/[0.11] border border-white/[0.14]"
                          />
                        )}
                        <Icon className="w-3 h-3 relative z-10" />
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close interview"
                  className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeMode === "single" ? (
                <>
                  {/* Player Identity Row */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-court-black shrink-0"
                      style={{ backgroundColor: badgeColor }}
                    >
                      {p.gamer_tag?.slice(0, 2).toUpperCase() || "2K"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                          {p.gamer_tag}
                        </h3>
                        <span className="text-[11px] font-mono text-win-green tabular">
                          WTP ${activeWtp.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/55 truncate">
                        <span style={{ color: badgeColor }} className="font-medium">
                          {archetypeLabel(p.archetype)}
                        </span>
                        {p.crew_name ? ` · ${p.crew_name}` : ""}
                        {p.creator_handle ? ` · ${p.creator_handle}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Compact Simulation Memory Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/80 tabular">
                      {rescuedInR3
                        ? `R2 ${shortVerdictLabel(r2State)} → R3 RESCUED`
                        : `R1 ${shortVerdictLabel(r1State)} → R2 ${shortVerdictLabel(r2State)}${
                            r3State ? ` → R3 ${shortVerdictLabel(r3State)}` : ""
                          }`}
                    </span>
                    {didFlip && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 truncate max-w-[195px]">
                        ↳ via {formatProvenanceSource(p)}
                      </span>
                    )}
                    {counterfactualEvent && (
                      <span className="px-1.5 py-0.5 rounded-md bg-win-green/10 border border-win-green/25 text-win-green truncate max-w-[140px]">
                        What-If Active
                      </span>
                    )}
                  </div>

                  {activeQuote && (
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs text-white/80 leading-relaxed">
                      &ldquo;{activeQuote}&rdquo;
                    </div>
                  )}
                </>
              ) : (
                /* 3-Way Crew Debate Header: Selected Debater Pill Badges */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/60 font-medium">
                      Courtside Locker Room Panel
                    </span>
                    <span className="text-[10px] font-mono text-white/40 tabular">
                      ${priceUsd.toFixed(2)} · 3 Stances
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPanel.map((slot) => (
                      <span
                        key={`${slot.roleLabel}-${slot.agent.gamer_tag}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-tight ${slot.accent}`}
                      >
                        <span className="opacity-75">{slot.roleLabel}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-white/90">
                          @{slot.agent.gamer_tag?.replace(/^@/, "")}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Conversation / Debate Thread */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {activeMode === "single" ? (
                messages.length === 0 ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-white/45 font-medium">
                      Suggested follow-ups
                    </p>
                    <div className="space-y-1.5">
                      {QUICK_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAskSingle(q)}
                          className="w-full text-left rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs text-white/85 hover:bg-white/[0.06] hover:border-white/[0.15] active:scale-[0.985] transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        m.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs max-w-[85%] leading-relaxed ${
                          m.role === "user"
                            ? "bg-twok-red text-white"
                            : "bg-white/[0.05] border border-white/[0.08] text-white/90"
                        }`}
                      >
                        <p>{m.text}</p>
                      </div>
                    </div>
                  ))
                )
              ) : debateExchanges.length === 0 ? (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-white/45 font-medium">
                    Debate starter prompts
                  </p>
                  <div className="space-y-1.5">
                    {DEBATE_STARTER_PROMPTS.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAskDebate(q)}
                        className="w-full text-left rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs text-white/85 hover:bg-white/[0.06] hover:border-white/[0.15] active:scale-[0.985] transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                debateExchanges.map((ex, exIdx) => (
                  <div key={exIdx} className="space-y-2.5 pb-2">
                    {/* Moderator Question Bubble */}
                    <div className="flex justify-end">
                      <div className="rounded-2xl bg-twok-red text-white px-3.5 py-2 text-xs max-w-[85%] leading-relaxed">
                        {ex.question}
                      </div>
                    </div>

                    {/* 3-Player Locker Room Thread */}
                    <div className="space-y-2">
                      {ex.turns.map((turn, tIdx) => {
                        const vBadge = verdictBadgeMeta(turn.fsm_state);
                        const turnColor = archetypeColor(
                          (turn.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL"
                        );
                        return (
                          <div
                            key={`${turn.gamer_tag}-${tIdx}`}
                            className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: turnColor }}
                                />
                                <span className="text-xs font-semibold text-white truncate">
                                  @{turn.gamer_tag.replace(/^@/, "")}
                                </span>
                                {turn.crew_name && (
                                  <span className="text-[10px] text-white/45 truncate">
                                    · {turn.crew_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono text-white/55 tabular">
                                  ${Number(turn.wtp_usd ?? priceUsd).toFixed(2)}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${vBadge.className}`}
                                >
                                  {vBadge.label}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-white/85 leading-relaxed">
                              {turn.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Fracture & Resolution Takeaway Glass Card */}
                    {ex.consensus_fracture_summary && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.1] px-3 py-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-vc-gold">
                          <Sparkles className="w-3 h-3" />
                          <span>Fracture &amp; Resolution</span>
                        </div>
                        <p className="text-[11px] text-white/80 leading-relaxed">
                          {ex.consensus_fracture_summary}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}

              {errorMsg && (
                <div className="rounded-xl border border-loss-red/30 bg-loss-red/10 px-3 py-2 text-xs text-loss-red">
                  {errorMsg}
                </div>
              )}

              {isLoading && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.04] w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse [animation-delay:300ms]" />
                </div>
              )}
            </div>

            {/* Question Input */}
            <div className="border-t border-white/[0.08] pt-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (activeMode === "single") {
                    handleAskSingle(inputQuestion);
                  } else {
                    handleAskDebate(inputQuestion);
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder={
                    activeMode === "single"
                      ? `Ask ${p.gamer_tag}...`
                      : "Ask the 3-player Locker Room panel..."
                  }
                  className="flex-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputQuestion.trim()}
                  aria-label="Send question"
                  className="p-2 rounded-full bg-twok-red text-white hover:bg-twok-red-deep disabled:opacity-30 active:scale-95 transition-all"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
