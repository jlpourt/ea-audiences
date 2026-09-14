"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Sparkles, Bot, Shield, TrendingUp, DollarSign } from "lucide-react";
import { CohortContext } from "@/lib/types";

interface DebateTurn {
  persona_id: string;
  archetype: string;
  avatar: string;
  name: string;
  message: string;
  wtp: number;
  fsm_state: string;
  sentiment_delta: string;
}

interface InteractiveDebateArenaProps {
  cohortContext?: CohortContext | null;
  creativeTitle: string;
  franchise: string;
  price: number;
}

const PRESET_QUESTIONS = [
  "What if we lower the price to $2.99?",
  "Would you rather have 2,400 CoD Points or 20 battle pass tier skips?",
  "How does a ranked loss streak affect your willingness to buy?",
  "Should we bundle a squad-wide double XP token?",
];

export default function InteractiveDebateArena({
  cohortContext,
  creativeTitle,
  franchise,
  price,
}: InteractiveDebateArenaProps) {
  const [question, setQuestion] = useState("");
  const [isDebating, setIsDebating] = useState(false);
  const [debateHistory, setDebateHistory] = useState<
    Array<{
      question: string;
      turns: DebateTurn[];
      takeaway: string;
    }>
  >([]);

  const handleAskQuestion = async (userQ?: string) => {
    const q = userQ || question;
    if (!q.trim()) return;

    setIsDebating(true);
    try {
      const res = await fetch("/api/synthetic/deepsona/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          campaign_title: creativeTitle,
          franchise,
          cohort_context: cohortContext,
          price,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDebateHistory((prev) => [
          {
            question: q,
            turns: data.debate_turns || [],
            takeaway: data.facilitator_takeaway || "",
          },
          ...prev,
        ]);
        setQuestion("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDebating(false);
    }
  };

  return (
    <div className="flex flex-col h-[380px] bg-surface-raised/90 border border-surface-border rounded-xl p-3 space-y-3 font-mono text-xs">
      {/* Question / Prompt Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-surface border border-electric-purple/40 rounded-xl px-3 py-1.5 focus-within:border-electric-purple focus-within:shadow-neon-purple transition-all">
            <MessageSquare className="w-4 h-4 text-electric-purple mr-2" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              placeholder="Ask the synthetic player personas a question (e.g. 'What if we offer 2,400 CoD Points?')..."
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-xs font-medium"
            />
          </div>

          <button
            onClick={() => handleAskQuestion()}
            disabled={isDebating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-electric-purple hover:bg-electric-purple/80 text-white font-bold shadow-neon-purple transition-all disabled:opacity-50"
          >
            {isDebating ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <span>Debate</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Preset Prompt Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-gray-500 uppercase">Quick Questions:</span>
          {PRESET_QUESTIONS.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuestion(pq);
                handleAskQuestion(pq);
              }}
              className="px-2 py-0.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-cyber-cyan whitespace-nowrap transition-all"
            >
              {pq}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Debate Transcript Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {debateHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <Bot className="w-8 h-8 text-electric-purple/50 mb-2 animate-bounce" />
            <p className="text-xs font-semibold text-gray-300">Live Persona Debate Arena Ready</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-md">
              Ask a question above or click a preset to trigger turn-by-turn arguments and psychological feedback from the 4 synthetic player personas.
            </p>
          </div>
        ) : (
          debateHistory.map((round, rIdx) => (
            <div key={rIdx} className="space-y-2 border-b border-surface-border/60 pb-3">
              {/* Marketer Question Bubble */}
              <div className="flex items-center gap-2 bg-electric-purple/10 border border-electric-purple/30 rounded-lg p-2 text-electric-purple">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-bold">Marketer Prompt:</span>
                <span className="text-white font-sans text-xs italic">&ldquo;{round.question}&rdquo;</span>
              </div>

              {/* Persona Turns */}
              <div className="grid grid-cols-2 gap-2">
                {round.turns.map((t, tIdx) => (
                  <div
                    key={tIdx}
                    className="p-2.5 rounded-lg bg-surface border border-surface-border space-y-1.5 hover:border-gray-500 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>{t.avatar}</span>
                        <span className="font-bold text-white text-[11px]">{t.name}</span>
                      </div>
                      <span className="text-hud-gold text-[10px] font-bold">WTP: ${t.wtp.toFixed(2)}</span>
                    </div>

                    <p className="text-gray-300 font-sans text-[11px] italic bg-background/50 p-2 rounded border border-surface-border">
                      &ldquo;{t.message}&rdquo;
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-surface-border font-bold text-gray-300">
                        {t.fsm_state}
                      </span>
                      <span className="text-neon-green font-bold">{t.sentiment_delta} sentiment</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Facilitator Takeaway */}
              {round.takeaway && (
                <div className="bg-surface/80 rounded-lg p-2 border border-cyber-cyan/30 text-[11px] text-cyber-cyan flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-neon-green" />
                  <span><strong>Consensus:</strong> {round.takeaway}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
