"use client";

import React, { useState } from "react";
import { Send, RotateCcw, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { CohortContext } from "@/lib/types";
import { archetypeLabel } from "@/lib/archetypes";

interface LiveDebateStreamProps {
  cohortContext?: CohortContext | null;
  creativeTitle: string;
  franchise: string;
  price: number;
}

const STARTER_QUESTIONS = [
  "Would you buy a $4.99 recovery starter after losing 3 matches in a row?",
  "Is $29.99 a fair price for a BlackCell battle pass that returns its own CP?",
  "How does a defeat streak change your willingness to spend that night?",
  "Should we bundle 20 tier skips instead of discounting the pass?",
];

export default function LiveDebateStream({
  cohortContext,
  creativeTitle,
  franchise,
  price,
}: LiveDebateStreamProps) {
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Clean empty initial state
  const [streamFeed, setStreamFeed] = useState<
    Array<{
      id: string;
      sender: string;
      role: string;
      text: string;
      wtp: number;
      fsm: string;
    }>
  >([]);

  const handleSendMessage = async (promptText?: string) => {
    const q = promptText || question;
    if (!q.trim()) return;

    setIsStreaming(true);

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
        const turns = data.debate_turns || [];

        const newItems = turns.map((t: any, idx: number) => ({
          id: `feed-new-${Date.now()}-${idx}`,
          sender: t.persona_id,
          role: archetypeLabel(t.archetype),
          text: t.message,
          wtp: t.wtp,
          fsm: t.fsm_state,
        }));

        setStreamFeed((prev) => [...prev, ...newItems]);
        setQuestion("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearStream = () => {
    setStreamFeed([]);
  };

  return (
    <div className="flex flex-col h-[340px] bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3 font-sans text-xs">
      {/* Top Action Bar if messages exist */}
      {streamFeed.length > 0 && (
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <span className="text-[11px] text-zinc-400 font-mono">Live Persona Interrogation Feed</span>
          <button
            onClick={handleClearStream}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Clear Feed</span>
          </button>
        </div>
      )}

      {/* Stream Messages */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {streamFeed.length === 0 ? (
          /* Clean Pristine Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2.5 text-zinc-400">
            <div className="w-9 h-9 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white block">Persona Live Chat is Clear</span>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                Ask a question to prompt live reactions and debate from the 4 synthetic gamer personas.
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-1 max-w-md">
              {STARTER_QUESTIONS.map((qText, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => handleSendMessage(qText)}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-[10px] font-medium transition-all text-left"
                >
                  💬 {qText}
                </button>
              ))}
            </div>
          </div>
        ) : (
          streamFeed.map((msg) => (
            <div
              key={msg.id}
              className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-xs">{msg.sender}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-mono">
                    {msg.role}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-zinc-400">WTP: <strong className="text-amber-400">${(msg.wtp || 0).toFixed(2)}</strong></span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      msg.fsm === "PURCHASED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : msg.fsm === "ENGAGED_FREE"
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {msg.fsm}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">{msg.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Ask the gamer personas a question..."
          className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
          disabled={isStreaming}
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={isStreaming || !question.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStreaming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 text-black" />
              <span>Ask</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
