"use client";

import React, { useState } from "react";
import { X, Image as ImageIcon, Mic, Music2, Copy, Check, Loader2, ArrowRight } from "lucide-react";
import { CohortContext } from "@/lib/types";
import { ModelBadge } from "@/components/brand/ModelBadge";
import { CompareSlider } from "@/components/brand/CompareSlider";
import { WaveformButton } from "@/components/brand/WaveformButton";
import { HoldToConfirm } from "@/components/brand/HoldToConfirm";
import { MODELS } from "@/lib/models";

export interface CreativeStudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audienceName: string;
  offerTitle: string;
  cohortContext?: CohortContext | null;
  onApproved?: () => void;
}

type ArtStyle = "myteam-pack" | "crew-reup" | "cross-label";
type VoiceName = "Charon" | "Fenrir" | "Kore";
type MusicMood = "arena-hype" | "trap-bass" | "vice-city-synth" | "cinematic-orchestral";

export function CreativeStudioPanel({
  isOpen,
  onClose,
  audienceName,
  offerTitle,
  cohortContext,
  onApproved,
}: CreativeStudioPanelProps) {
  // 1. Pack Art State
  const [artStyle, setArtStyle] = useState<ArtStyle>("myteam-pack");
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [generatedArtUrl, setGeneratedArtUrl] = useState<string | null>(null);
  const [artModelUsed, setArtModelUsed] = useState<string>(MODELS.IMAGE.id);
  const [copiedArtUrl, setCopiedArtUrl] = useState(false);

  // 2. Announcer VO State
  const [voice, setVoice] = useState<VoiceName>("Charon");
  const [script, setScript] = useState(
    "Season 1 ends October 16! Re-up your squad with 15,000 VC and get back on the floor tonight!"
  );
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceModelUsed, setVoiceModelUsed] = useState<string>(MODELS.TTS.id);

  // 3. Music Bed State
  const [musicMood, setMusicMood] = useState<MusicMood>("arena-hype");
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicModelUsed, setMusicModelUsed] = useState<string>(MODELS.MUSIC.id);

  // 4. Approval State
  const [isApproved, setIsApproved] = useState(false);

  if (!isOpen) return null;

  const defaultBeforeSrc =
    artStyle === "crew-reup"
      ? "/brands/2k/art/crew-reup.webp"
      : "/brands/2k/art/myteam-pack-galaxy-opal.webp";

  const handleGenerateArt = async () => {
    setIsGeneratingArt(true);
    try {
      const res = await fetch("/api/creative/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerTitle,
          audienceName,
          style: artStyle,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedArtUrl(data.url);
        if (data.modelUsed) setArtModelUsed(data.modelUsed);
      }
    } catch (err) {
      console.error("[Generate Art Error]:", err);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  const handleCopyArtUrl = () => {
    if (!generatedArtUrl) return;
    navigator.clipboard.writeText(generatedArtUrl);
    setCopiedArtUrl(true);
    setTimeout(() => setCopiedArtUrl(false), 2000);
  };

  const handleGenerateVoice = async () => {
    setIsGeneratingVoice(true);
    try {
      const res = await fetch("/api/creative/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerTitle,
          audienceName,
          script,
          voice,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setVoiceUrl(data.url);
        if (data.script) setScript(data.script);
        if (data.modelUsed) setVoiceModelUsed(data.modelUsed);
      }
    } catch (err) {
      console.error("[Generate Voice Error]:", err);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleGenerateMusic = async () => {
    setIsGeneratingMusic(true);
    try {
      const res = await fetch("/api/creative/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: musicMood }),
      });
      const data = await res.json();
      if (data.url) {
        setMusicUrl(data.url);
        if (data.modelUsed) setMusicModelUsed(data.modelUsed);
      }
    } catch (err) {
      console.error("[Generate Music Error]:", err);
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleApprovalConfirm = () => {
    setIsApproved(true);
    if (onApproved) {
      onApproved();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Creative Studio"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Sliding Sheet with custom drawer easing */}
      <div
        style={{
          transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
        className="glass-enter h-full w-full max-w-xl bg-[#121216]/95 border-l border-white/10 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl backdrop-blur-2xl text-chalk font-sans"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-twok-red font-semibold uppercase tracking-wider">
                2K Courtside • Creative Studio
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-chalk-dim uppercase">
                Multimodal Pipeline
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-chalk mt-1">
              {offerTitle}
            </h2>
            <p className="text-xs text-chalk-dim mt-0.5">
              Audience: <span className="text-chalk">{audienceName}</span>
              {cohortContext?.matchedCount ? (
                <span className="font-mono text-chalk-dim ml-1">
                  ({cohortContext.matchedCount.toLocaleString()} players)
                </span>
              ) : null}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Creative Studio"
            className="p-1.5 rounded-lg text-chalk-dim hover:text-chalk hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content */}
        <div className="space-y-6 py-4 flex-1">
          {/* Section 1: Pack Art Generator */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-twok-red" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-chalk">
                  Pack & Promo Art
                </h3>
              </div>
              <ModelBadge modelId={artModelUsed || MODELS.IMAGE.id} size="sm" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                {(["myteam-pack", "crew-reup", "cross-label"] as ArtStyle[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setArtStyle(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      artStyle === st
                        ? "bg-twok-red text-white"
                        : "bg-white/5 text-chalk-dim hover:text-white"
                    }`}
                  >
                    {st === "myteam-pack"
                      ? "Galaxy Opal Pack"
                      : st === "crew-reup"
                        ? "Crew Re-Up"
                        : "2K26 → 2K27 Upgrade"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGenerateArt}
                disabled={isGeneratingArt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                {isGeneratingArt ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <span>Generate Art</span>
                )}
              </button>
            </div>

            {/* CompareSlider: Before vs Live Generated Image */}
            <CompareSlider
              beforeSrc={defaultBeforeSrc}
              afterSrc={generatedArtUrl || defaultBeforeSrc}
              beforeLabel="Standard Store Tile"
              afterLabel="Custom Render"
              aspectClass="aspect-[16/10]"
            />

            {generatedArtUrl && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-black/40 border border-white/5 px-2.5 py-1.5 text-[11px]">
                <span className="truncate font-mono text-chalk-dim text-[10px]">
                  {generatedArtUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyArtUrl}
                  className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-chalk text-[10px] font-medium"
                >
                  {copiedArtUrl ? (
                    <>
                      <Check className="w-3 h-3 text-win-green" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Arena Announcer VO Generator */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-twok-red" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-chalk">
                  Arena PA Announcer Voiceover
                </h3>
              </div>
              <ModelBadge modelId={voiceModelUsed || MODELS.TTS.id} size="sm" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase text-chalk-dim font-medium">Voice:</span>
                {(["Charon", "Fenrir", "Kore"] as VoiceName[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      voice === v
                        ? "bg-vc-gold text-court-black"
                        : "bg-white/5 text-chalk-dim hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGenerateVoice}
                disabled={isGeneratingVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                {isGeneratingVoice ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <span>Generate VO</span>
                )}
              </button>
            </div>

            {/* Editable Script */}
            <div className="space-y-1">
              <label className="text-[10px] text-chalk-dim uppercase block">
                Announcer Copy (&le; 28 words):
              </label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-chalk focus:border-twok-red focus:outline-none"
              />
            </div>

            {/* Waveform Button */}
            {voiceUrl ? (
              <WaveformButton
                src={voiceUrl}
                label="Arena PA Announcer Promo"
                sublabel={`Arena PA · ${voice}`}
                tone="red"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-2.5 text-center text-[11px] text-chalk-dim">
                Click &ldquo;Generate VO&rdquo; to synthesize live arena voiceover.
              </div>
            )}
          </div>

          {/* Section 3: Arena Hype Bed Generator */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 className="w-4 h-4 text-vc-gold" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-chalk">
                  Arena Hype Bed (128 BPM)
                </h3>
              </div>
              <ModelBadge modelId={musicModelUsed || MODELS.MUSIC.id} size="sm" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <select
                value={musicMood}
                onChange={(e) => setMusicMood(e.target.value as MusicMood)}
                className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-chalk focus:outline-none"
              >
                <option value="arena-hype">Stadium Hype Bed (128 BPM)</option>
                <option value="trap-bass">808 City Trap Beat</option>
                <option value="vice-city-synth">Vice City Neon Synthwave</option>
                <option value="cinematic-orchestral">Playoff Fanfare Orchestral</option>
              </select>

              <button
                type="button"
                onClick={handleGenerateMusic}
                disabled={isGeneratingMusic}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                {isGeneratingMusic ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Composing...</span>
                  </>
                ) : (
                  <span>Generate Beat</span>
                )}
              </button>
            </div>

            {musicUrl ? (
              <WaveformButton
                src={musicUrl}
                label="Arena Sound Bed"
                sublabel={`128 BPM · ${musicMood}`}
                tone="gold"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-2.5 text-center text-[11px] text-chalk-dim">
                Click &ldquo;Generate Beat&rdquo; to synthesize custom arena hype music.
              </div>
            )}
          </div>
        </div>

        {/* Footer with HoldToConfirm */}
        <div className="border-t border-white/10 pt-4 flex items-center justify-between gap-4">
          <div className="text-[11px] text-chalk-dim">
            {isApproved ? (
              <span className="text-win-green font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Creative pack approved & dispatched to A2A event bus
              </span>
            ) : (
              <span>Ready for human-in-the-loop activation gate</span>
            )}
          </div>

          <HoldToConfirm
            label="Hold to approve for activation"
            confirmedLabel="Approved & Dispatched"
            tone="red"
            onConfirm={handleApprovalConfirm}
            disabled={isApproved}
          />
        </div>
      </div>
    </div>
  );
}

export default CreativeStudioPanel;
