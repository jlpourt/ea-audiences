"use client";

import React, { useState } from "react";
import { MessageSquare, ThumbsUp, MessageCircle, AlertTriangle, ShieldCheck, Sparkles, Send, Radio, Hash, RotateCcw, Loader2, ArrowBigUp, CornerDownRight } from "lucide-react";
import { GameFranchise, CohortContext } from "@/lib/types";

interface CommunityDebateSimulatorProps {
  franchise: string;
  selectedGame: GameFranchise;
  creativeTitle: string;
  cohortContext?: CohortContext | null;
}

interface RedditReply {
  author: string;
  flair?: string;
  upvotes?: number;
  time_ago?: string;
  content: string;
}

interface CommunityComment {
  id: string;
  author: string;
  flair?: string;
  upvotes: number;
  timeAgo: string;
  content: string;
  sentiment: "HYPED" | "FAIR_VALUE" | "SKEPTICAL" | "ANTI_P2W";
  replies?: RedditReply[];
}

interface DiscordMessage {
  id: string;
  user: string;
  role: string;
  avatarColor: string;
  time: string;
  content: string;
  reactions: string[];
}

const STARTER_PROMPTS = [
  "Would you buy a $4.99 Loss-Shield reset pack after losing 3 matches?",
  "Is $49.99 a fair price for guaranteed walkout packs & 4,800 FC Points?",
  "How does defeat-streak tilt affect your willingness to buy packs?",
  "Should we include a 4-player Rush 5v5 squad double XP token?",
];

export default function CommunityDebateSimulator({
  franchise,
  selectedGame,
  creativeTitle,
  cohortContext,
}: CommunityDebateSimulatorProps) {
  const [activePlatform, setActivePlatform] = useState<"discord" | "reddit">("discord");
  const [prompt, setPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [threadTitle, setThreadTitle] = useState("");

  const subredditName =
    selectedGame === "COD"
      ? "r/CODWarzone"
      : selectedGame === "WOW"
      ? "r/wow"
      : selectedGame === "DIABLO4"
      ? "r/diablo4"
      : selectedGame === "OVERWATCH2"
      ? "r/Overwatch"
      : selectedGame === "CANDYCRUSH"
      ? "r/candycrush"
      : "r/battlenet";

  const discordServerName =
    selectedGame === "COD"
      ? "Call of Duty: Warzone Official Discord"
      : selectedGame === "WOW"
      ? "Warcraft Mythic Guild Hub"
      : selectedGame === "DIABLO4"
      ? "Diablo IV Sanctuary Discord"
      : selectedGame === "OVERWATCH2"
      ? "Overwatch 2 Competitive Hub"
      : selectedGame === "CANDYCRUSH"
      ? "Candy Crush Community"
      : "Battle.net Community Hub";

  // Clean empty initial state
  const [redditComments, setRedditComments] = useState<CommunityComment[]>([]);
  const [discordMessages, setDiscordMessages] = useState<DiscordMessage[]>([]);

  const handleTestCommunityResponse = async (customPrompt?: string) => {
    const userPrompt = customPrompt || prompt;
    if (!userPrompt.trim()) return;
    setPrompt("");
    setIsSimulating(true);

    try {
      const res = await fetch("/api/synthetic/deepsona/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userPrompt,
          campaign_title: creativeTitle,
          franchise,
          platform: activePlatform,
          cohort_context: cohortContext,
          price: 4.99,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const turns = data.debate_turns || [];

        if (data.thread_title) {
          setThreadTitle(data.thread_title);
        }

        if (activePlatform === "reddit") {
          const newComments: CommunityComment[] = turns.map((t: any, idx: number) => ({
            id: `comm-new-${Date.now()}-${idx}`,
            author: t.name || t.persona_id || `u/FC_Grinder_${idx}`,
            flair: t.flair || t.archetype,
            upvotes: t.upvotes || Math.floor(Math.random() * 200) + 120,
            timeAgo: t.time_ago || "just now",
            content: t.message,
            sentiment: t.sentiment || (t.fsm_state === "PURCHASED" ? "HYPED" : t.fsm_state === "ENGAGED_FREE" ? "FAIR_VALUE" : "ANTI_P2W"),
            replies: t.replies || [],
          }));
          setRedditComments((prev) => [...newComments, ...prev]);
        } else {
          const newDiscord: DiscordMessage[] = turns.map((t: any, idx: number) => ({
            id: `disc-new-${Date.now()}-${idx}`,
            user: `${t.persona_id.replace(/^u\//, '')}#${Math.floor(1000 + Math.random() * 9000)}`,
            role: t.archetype,
            avatarColor: idx % 2 === 0 ? "#00F0FF" : "#FFB800",
            time: "Just now",
            content: t.message,
            reactions: ["🔥 4", "💬 2"],
          }));
          setDiscordMessages((prev) => [...newDiscord, ...prev]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearChat = () => {
    setDiscordMessages([]);
    setRedditComments([]);
  };

  const handleUpvote = (commentId: string) => {
    setRedditComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, upvotes: c.upvotes + 1 } : c))
    );
  };

  const hasMessages = activePlatform === "reddit" ? redditComments.length > 0 : discordMessages.length > 0;

  return (
    <div className="space-y-3 font-sans text-xs">
      {/* 1. Header with Platform Switcher & Clear Button */}
      <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-2xl border border-white/5">
        {/* Platform Toggle */}
        <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActivePlatform("discord")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePlatform === "discord"
                ? "bg-[#5865F2] text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>{discordServerName} (Discord Voice/Chat)</span>
          </button>

          <button
            onClick={() => setActivePlatform("reddit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePlatform === "reddit"
                ? "bg-[#FF4500] text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{subredditName} (Reddit Community Thread)</span>
          </button>
        </div>

        {/* Action / Clear */}
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] font-mono transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Chat</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Live Vertex AI Gemini 3.5 Flash-Lite</span>
          </div>
        </div>
      </div>

      {/* 2. Platform Feed Container */}
      <div className="bg-black/30 rounded-2xl border border-white/5 p-4 h-[290px] overflow-y-auto space-y-3">
        {!hasMessages ? (
          /* Clean Pristine Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-zinc-400">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400">
              {activePlatform === "discord" ? <Hash className="w-5 h-5 text-[#5865F2]" /> : <MessageSquare className="w-5 h-5 text-[#FF4500]" />}
            </div>
            <div className="space-y-1">
              <span className="text-sm font-semibold text-white block">
                {activePlatform === "discord" ? "Synthetic Discord Channel is Clear" : "Reddit Discussion Thread is Clear"}
              </span>
              <p className="text-xs text-zinc-500 max-w-md">
                {activePlatform === "discord"
                  ? "Ask the Discord audience a question to simulate real-time chat chatter and voice call reactions."
                  : "Post a question or select a starter topic to simulate community debates, upvote dynamics, and nested analysis on Reddit."}
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-2 max-w-lg">
              {STARTER_PROMPTS.map((starter, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => handleTestCommunityResponse(starter)}
                  disabled={isSimulating}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition-all text-left"
                >
                  💬 {starter}
                </button>
              ))}
            </div>
          </div>
        ) : activePlatform === "reddit" ? (
          /* Reddit Thread View with Nested Replies & Rich Formatting */
          <div className="space-y-3">
            <div className="border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="font-semibold text-[#FF4500]">{subredditName}</span>
                <span>•</span>
                <span>Posted by u/EA_LiveOps_Analyst</span>
                <span>•</span>
                <span className="text-zinc-500">2 hours ago</span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-1">
                {threadTitle || `[Discussion] In-Game Live Drop Preview: ${creativeTitle}`}
              </h3>
            </div>

            {/* Comment Stream */}
            <div className="space-y-3">
              {redditComments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.03] border border-white/5 space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-300">{c.author}</span>
                      {c.flair && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-zinc-400 font-mono border border-white/5">
                          {c.flair}
                        </span>
                      )}
                      <span className="text-zinc-500 text-[10px]">{c.timeAgo}</span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        c.sentiment === "HYPED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : c.sentiment === "FAIR_VALUE"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {c.sentiment}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-200 leading-relaxed font-normal whitespace-pre-line">{c.content}</p>

                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1">
                    <button
                      onClick={() => handleUpvote(c.id)}
                      className="flex items-center gap-1 hover:text-[#FF4500] transition-colors"
                    >
                      <ArrowBigUp className="w-4 h-4 text-zinc-400 hover:text-[#FF4500]" />
                      <span className="font-semibold">{c.upvotes}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">{c.replies?.length || 0} replies</span>
                    </div>
                  </div>

                  {/* Nested Replies */}
                  {c.replies && c.replies.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-white/10 space-y-2 pt-1">
                      {c.replies.map((rep, rIdx) => (
                        <div key={rIdx} className="bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-1">
                          <div className="flex items-center gap-2 text-[10px]">
                            <CornerDownRight className="w-3 h-3 text-zinc-500" />
                            <span className="font-semibold text-zinc-300">{rep.author}</span>
                            {rep.flair && (
                              <span className="px-1 py-0.2 rounded bg-white/5 text-[9px] text-zinc-500">
                                {rep.flair}
                              </span>
                            )}
                            <span className="text-zinc-600">• {rep.time_ago || "1h ago"}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-relaxed pl-5">{rep.content}</p>
                          {rep.upvotes && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 pl-5">
                              <ArrowBigUp className="w-3 h-3" />
                              <span>{rep.upvotes} upvotes</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Discord Chat View */
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-zinc-400" />
                <span className="font-semibold text-white">#live-drops-chat</span>
                <span>•</span>
                <span className="text-zinc-500">Simulated Discord multi-agent chat</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">● Active Voice/Text</span>
            </div>

            <div className="space-y-2.5">
              {discordMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black text-xs flex-shrink-0"
                    style={{ backgroundColor: msg.avatarColor }}
                  >
                    {msg.user.charAt(0)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">{msg.user}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 font-mono">
                        {msg.role}
                      </span>
                      <span className="text-[10px] text-zinc-500">{msg.time}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{msg.content}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {msg.reactions.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-zinc-400 border border-white/5"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Prompt Input Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2 focus-within:border-cyan-500 transition-colors shadow-inner">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTestCommunityResponse()}
            placeholder={
              activePlatform === "discord"
                ? "Ask the Discord channel (e.g. 'Would you buy this pack at $4.99?')..."
                : "Post a topic / question to the Reddit thread..."
            }
            className="w-full bg-transparent text-white placeholder-zinc-500 text-xs focus:outline-none"
            disabled={isSimulating}
          />
        </div>

        <button
          onClick={() => handleTestCommunityResponse()}
          disabled={isSimulating || !prompt.trim()}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-lg transition-all ${
            isSimulating || !prompt.trim()
              ? "bg-white/10 text-zinc-500 cursor-not-allowed"
              : activePlatform === "discord"
              ? "bg-[#5865F2] hover:bg-[#4752C4] text-white"
              : "bg-[#FF4500] hover:bg-[#E03D00] text-white"
          }`}
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{activePlatform === "discord" ? "Ask Discord" : "Post to Reddit"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
