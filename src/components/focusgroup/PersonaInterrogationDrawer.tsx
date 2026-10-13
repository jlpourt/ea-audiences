"use client";

import React, { useState } from "react";
import { X, Send, Loader2, MessageCircle, Bot } from "lucide-react";
import { FocusGroupReaction } from "@/lib/types";
import { archetypeColor, archetypeLabel } from "@/lib/archetypes";
import { ModelBadge } from "@/components/brand/ModelBadge";
import { MODELS } from "@/lib/models";

interface PersonaInterrogationDrawerProps {
  persona: FocusGroupReaction | null;
  onClose: () => void;
  offerTitle: string;
  priceUsd: number;
}

interface ChatMessage {
  role: "user" | "persona";
  text: string;
  modelUsed?: string;
}

const QUICK_QUESTIONS = [
  "Why would you pass or buy at this price?",
  "What VC bundle or perk would change your mind?",
  "How will your Crew / Park teammates react?",
  "Does this feel pay-to-win or fair progression?",
];

export function PersonaInterrogationDrawer({
  persona,
  onClose,
  offerTitle,
  priceUsd,
}: PersonaInterrogationDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!persona) return null;

  const handleAsk = async (question: string) => {
    if (!question.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: "user", text: question.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/synthetic/focus-group/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          question: question.trim(),
          offer_title: offerTitle,
          price_usd: priceUsd,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          {
            role: "persona",
            text: data.answer,
            modelUsed: data.model_used,
          },
        ]);
      }
    } catch (err) {
      console.error("[Interrogate Error]:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const badgeColor = archetypeColor(persona.archetype);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Interrogate ${persona.gamer_tag}`}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm font-sans"
      onClick={onClose}
    >
      <div
        style={{
          transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
        className="glass-enter h-full w-full max-w-md bg-[#121216] border-l border-white/10 p-5 flex flex-col justify-between shadow-2xl backdrop-blur-2xl text-chalk"
      >
        {/* Drawer Header */}
        <div className="border-b border-white/10 pb-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-twok-red font-semibold uppercase tracking-wider">
                Persona Interrogation
              </span>
              <ModelBadge modelId={MODELS.REASONING.id} size="sm" />
            </div>
            <button
              onClick={onClose}
              aria-label="Close interrogation"
              className="p-1 rounded-md text-chalk-dim hover:text-chalk hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-court-black shadow"
              style={{ backgroundColor: badgeColor }}
            >
              {persona.gamer_tag?.slice(0, 2).toUpperCase() || "2K"}
            </div>
            <div>
              <h3 className="text-sm font-bold text-chalk">{persona.gamer_tag}</h3>
              <div className="flex items-center gap-2 text-[11px] text-chalk-dim">
                <span style={{ color: badgeColor }} className="font-medium">
                  {archetypeLabel(persona.archetype)}
                </span>
                <span>•</span>
                <span className="font-mono">WTP: ${persona.willingness_to_pay_usd?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-black/40 border border-white/5 p-2 text-xs italic text-chalk-dim leading-relaxed">
            &ldquo;{persona.verbatim_quote}&rdquo;
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {messages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-chalk-dim">
                Ask this persona follow-up questions to understand price sensitivity, VC skepticism, or feature trade-offs:
              </p>
              <div className="space-y-1.5">
                {QUICK_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAsk(q)}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs text-chalk hover:bg-white/10 hover:border-twok-red/50 transition-colors"
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
                  className={`rounded-xl p-3 text-xs max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-twok-red text-white"
                      : "bg-white/[0.04] border border-white/10 text-chalk"
                  }`}
                >
                  <p>{m.text}</p>
                </div>
                {m.modelUsed && (
                  <span className="text-[9px] font-mono text-chalk-dim/60 mt-0.5 px-1">
                    Deep Synthesis
                  </span>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-chalk-dim py-2">
              <Loader2 className="w-3.5 h-3.5 courtside-Transfer-pulse text-twok-red" />
              <span>Persona is formulating reasoning response...</span>
            </div>
          )}
        </div>

        {/* Question Input */}
        <div className="border-t border-white/10 pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(inputQuestion);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={`Ask ${persona.gamer_tag}...`}
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-chalk focus:border-twok-red focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuestion.trim()}
              className="p-2 rounded-lg bg-twok-red text-white hover:bg-twok-red-deep disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
