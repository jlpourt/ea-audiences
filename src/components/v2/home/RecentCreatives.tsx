"use client";

/**
 * Recent creatives strip: the latest generated images in the live GCS media
 * bucket (GET /api/insights/recent-creatives). Empty bucket -> empty state with
 * a "Create an ad" CTA into the existing Creative Studio. No stand-in images.
 *
 * Motion: each thumbnail reveals with a clip-path wipe once its bytes load
 * (prevents a jarring pop-in of 1.5MB PNGs); hover zooms the image 3%.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ImageIcon, Plus, Wand2 } from "lucide-react";
import { ease } from "../motion";
import { LiveErrorNote, SectionHeading } from "./atoms";
import { useLiveJson } from "./useLiveJson";

interface Item {
  name: string;
  url: string;
  updated: string;
}
interface Resp {
  bucket: string;
  items: Item[];
}

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function RecentCreatives({ onCreate }: { onCreate: () => void }) {
  const { data, error, loading, reload } = useLiveJson<Resp>("/api/insights/recent-creatives?limit=5");
  const items = data?.items ?? [];

  const createBtn = (
    <button
      type="button"
      onClick={onCreate}
      className="v2-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
    >
      <Wand2 size={13} strokeWidth={1.75} />
      Create an ad
    </button>
  );

  return (
    <section>
      <SectionHeading
        icon={<ImageIcon size={14} strokeWidth={1.75} />}
        title="Recent creatives"
        meta={data ? `${items.length} latest · Cloud Storage` : undefined}
        action={items.length ? createBtn : undefined}
      />
      {error && <LiveErrorNote error={error} onRetry={reload} compact />}
      {loading && !data && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="v2-skeleton aspect-square rounded-[var(--radius)]" />
          ))}
        </div>
      )}
      {data && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
            <ImageIcon size={18} strokeWidth={1.75} />
          </span>
          <div className="text-[13px] text-[var(--text-dim)]">No creatives yet</div>
          <button
            type="button"
            onClick={onCreate}
            className="v2-press inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]"
          >
            <Wand2 size={14} strokeWidth={1.75} />
            Create an ad
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {items.map((it, i) => (
            <Thumb key={it.name} item={it} index={i} />
          ))}
          <button
            type="button"
            onClick={onCreate}
            aria-label="Create an ad"
            className="v2-press group grid aspect-square place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] text-[var(--text-faint)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span className="flex flex-col items-center gap-1.5 text-[12px]">
              <Plus size={18} strokeWidth={1.75} className="transition-transform duration-200 ease-out group-hover:rotate-90" />
              New
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

function Thumb({ item, index }: { item: Item; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const reduce = useReducedMotion();
  const img = useRef<HTMLImageElement>(null);
  // The image can finish before hydration attaches onLoad; catch that case.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-square overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]"
      title={`Generated ${ago(item.updated)}`}
    >
      {!loaded && <div className="v2-skeleton absolute inset-0 rounded-none" />}
      <motion.div
        className="absolute inset-0"
        initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)", transform: "scale(1.06)" }}
        animate={
          loaded
            ? reduce
              ? { opacity: 1 }
              : { opacity: 1, clipPath: "inset(0 0 0% 0)", transform: "scale(1)" }
            : undefined
        }
        transition={{ duration: 0.6, ease: ease.out, delay: index * 0.05 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={img}
          src={item.url}
          alt="Generated creative"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      </motion.div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 text-[11px] text-white/85 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {ago(item.updated)}
      </span>
    </a>
  );
}
