"use client";

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PersonaProfile } from "./SyntheticPersonaCard";
import { CohortContext } from "@/lib/types";

interface PersonaInterrogationProps {
  persona: PersonaProfile;
  cohortContext?: CohortContext | null;
  creativeTitle: string;
  onBack: () => void;
}

export default function PersonaInterrogation({
  persona,
  cohortContext,
  creativeTitle,
  onBack,
}: PersonaInterrogationProps) {
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ sender: "marketer" | "persona"; text: string }>
  >([
    {
      sender: "persona",
      text: persona.quote,
    },
  ]);

  const handleAsk = async (customQ?: string) => {
    const q = customQ || question;
    if (!q.trim()) return;

    const newMsgs = [...messages, { sender: "marketer" as const, text: q }];
    setMessages(newMsgs);
    setQuestion("");
    setIsAsking(true);

    try {
      const res = await fetch("/api/synthetic/deepsona/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Direct 1-on-1 interview with ${persona.name} (${persona.gamerTag}, ${persona.archetype}): "${q}"`,
          campaign_title: creativeTitle,
          cohort_context: cohortContext,
          price: persona.wtp,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const turn = data.debate_turns?.find(
          (t: any) => t.persona_id === persona.id || t.archetype === persona.archetype
        );
        const reply = turn?.message || `As ${persona.gamerTag}, I evaluate this offer based on my division matches and tilt triggers.`;
        setMessages([...newMsgs, { sender: "persona", text: reply }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Personas</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{persona.gamerTag}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
            {persona.division}
          </span>
        </div>
      </div>

      {/* Main Content: Telemetry Column + Chat Column */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left Telemetry Column */}
        <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block border-b border-white/5 pb-2">
            Player Profile & Telemetry
          </span>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Archetype</span>
              <span className="text-white font-medium">{persona.archetype}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Matches Played</span>
              <span className="text-white font-medium">{persona.matchesPlayed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Lifetime Spend</span>
              <span className="text-amber-300 font-medium font-mono">${persona.spendLtv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Loss Streak</span>
              <span className="text-white font-medium">{persona.recentLossStreak} Matches</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tilt Risk</span>
              <span className="text-white font-medium">{persona.tiltLevel}/100</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 space-y-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Suggested Questions</span>
            <button
              onClick={() => handleAsk("Why did you rage-quit your last match?")}
              className="w-full text-left p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-gray-300 hover:text-white transition-all"
            >
              &ldquo;Why did you rage-quit your last match?&rdquo;
            </button>
            <button
              onClick={() => handleAsk("What would make you spend $20 right now?")}
              className="w-full text-left p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-gray-300 hover:text-white transition-all"
            >
              &ldquo;What would make you spend $20 right now?&rdquo;
            </button>
          </div>
        </div>

        {/* Right Chat Column */}
        <div className="col-span-2 flex flex-col justify-between h-[340px] bg-black/40 p-4 rounded-2xl border border-white/5">
          <div className="overflow-y-auto space-y-3 pr-1 flex-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.sender === "marketer" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    m.sender === "marketer"
                      ? "bg-white text-black font-medium"
                      : "bg-white/10 text-gray-200 border border-white/10"
                  }`}
                >
                  <span className="text-[10px] block opacity-60 mb-0.5">
                    {m.sender === "marketer" ? "You" : persona.gamerTag}
                  </span>
                  <p className="text-xs leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="text-xs text-gray-400 italic">
                {persona.gamerTag} is responding with Gemini Flash...
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder={`Ask ${persona.gamerTag} directly...`}
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={() => handleAsk()}
              disabled={isAsking}
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 font-semibold text-xs transition-all disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
