"use client";

/**
 * <BrandAttachCard /> Brand + Crew (cosmetic purchases).
 *
 * GET /api/v2/brand/attach (BigQuery; + Spanner Graph when a storyline player is set).
 *  - branded VC revenue ticker
 *  - brand wordmark selector (logo from the partner's public logo_url, text wordmark otherwise)
 *  - attach rate, in-crew vs out-of-crew attach bars, co-play social multiplier
 *  - "players like you bought" row: items slide in with a 50ms stagger
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, User, Shirt, Footprints, Gem, Package } from "lucide-react";
import { ActiveIndicator, AnimatePresence, Ticker, ease, STAGGER } from "@/components/v2/motion";
import { useOptionalStoryline } from "@/components/v2/shell/StorylineProvider";
import type { BrandAttachResponse, BrandAttachRow } from "@/lib/v2/creatorbrand";
import { CardFrame, ErrorPanel, GrowBar, LiveBadge, SkeletonBlock, fmtCompact, fmtInt, fmtPct, useLiveJson } from "./shared";

export interface BrandAttachCardProps {
  /** Player for the "players like you bought" row. Defaults to the storyline player. */
  playerId?: string | null;
  className?: string;
}

export function BrandAttachCard({ playerId, className }: BrandAttachCardProps) {
  const story = useOptionalStoryline();
  const pid = playerId ?? story?.playerId ?? null;
  const url = `/api/v2/brand/attach${pid ? `?player_id=${encodeURIComponent(pid)}` : ""}`;
  const { data, error, loading, reload } = useLiveJson<BrandAttachResponse>(url);
  const [selected, setSelected] = useState<string | null>(null);

  const brands = useMemo(() => (data?.brands || []).filter((b) => b.exposed_n > 0 || b.branded_vc_revenue > 0), [data]);
  useEffect(() => {
    if (brands.length && (!selected || !brands.some((b) => b.brand_id === selected))) setSelected(brands[0].brand_id);
  }, [brands, selected]);
  const current = brands.find((b) => b.brand_id === selected) ?? null;

  return (
    <CardFrame
      className={className}
      eyebrow="Brand + Crew"
      title="Branded VC revenue"
      right={data ? <LiveBadge engines={data.engines} ms={data.latency_ms.total} /> : null}
    >
      {error ? (
        <ErrorPanel error={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonBlock rows={4} />
      ) : data && current ? (
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-2">
                <Ticker
                  value={data.totals.branded_vc_revenue}
                  format={(n) => fmtCompact(n)}
                  className="v2-tabular text-[44px] font-semibold leading-none tracking-[-0.03em] text-v2-text"
                />
                <span className="text-[13px] text-v2-dim">VC</span>
              </div>
              <p className="mt-2 text-[12px] text-v2-faint v2-tabular">
                {fmtPct(data.totals.branded_share)} of all VC spend · {brands.length} partners
              </p>
            </div>
            {data.totals.social_multiplier_adjusted !== null && (
              <div
                className="text-right"
                title={`Mantel-Haenszel risk ratio stratified by brand. Crude pooled ratio ${data.totals.social_multiplier_crude ?? "n/a"}x is inflated by brand popularity (Simpson's paradox).`}
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-v2-faint">Co-play multiplier</p>
                <Ticker
                  value={data.totals.social_multiplier_adjusted}
                  decimals={2}
                  suffix={"\u00d7"}
                  className="v2-tabular text-[22px] font-semibold text-v2-accent"
                />
                <p className="text-[11px] text-v2-faint v2-tabular">
                  {data.totals.social_adjusted_ci_low?.toFixed(2)} to {data.totals.social_adjusted_ci_high?.toFixed(2)} · brand-adjusted
                </p>
              </div>
            )}
          </div>

          <BrandStrip brands={brands} selected={current.brand_id} onSelect={setSelected} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.brand_id}
              initial={{ opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transform: "translateY(-4px)" }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="space-y-5"
            >
              <BrandStats b={current} />
              <ItemsRow
                title={
                  data.players_like_you_bought
                    ? `Players like ${data.players_like_you_bought.gamer_tag ?? "you"} bought`
                    : `Players like you bought · ${current.brand}`
                }
                items={
                  data.players_like_you_bought && data.players_like_you_bought.items.length
                    ? data.players_like_you_bought.items.map((it) => ({
                        key: it.item_id,
                        name: it.name,
                        type: it.item_type,
                        brand: it.brand,
                        price: it.vc_price,
                        meta: `${it.neighbor_buyers} co-players`,
                      }))
                    : current.top_items.map((it) => ({
                        key: it.item_id,
                        name: it.name,
                        type: it.item_type,
                        brand: current.brand,
                        price: it.vc_price,
                        meta: `${fmtInt(it.social_buyers)} via co-play`,
                      }))
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : data ? (
        <p className="text-[13px] text-v2-dim">No branded purchases in the live window.</p>
      ) : null}
    </CardFrame>
  );
}

/* ------------------------------------------------------------------ */

/** Logos drawn as a filled box (e.g. Amex's blue box) collapse to a solid square under the
 * monochrome filter, so render those partners as text wordmarks instead. */
const BOXED_LOGO_BRANDS = new Set(["american-express"]);

function Wordmark({ b, active }: { b: BrandAttachRow; active: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  if (b.logo_url && imgOk && !BOXED_LOGO_BRANDS.has(b.brand_id)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={b.logo_url}
        alt={b.brand}
        onError={() => setImgOk(false)}
        className="cb-logo h-5 w-auto max-w-[88px] object-contain"
        style={{ opacity: active ? 1 : 0.55, transition: "opacity 160ms ease" }}
      />
    );
  }
  return (
    <span
      className={`text-[13px] font-semibold uppercase tracking-[0.08em] ${active ? "text-v2-text" : "text-v2-dim"}`}
    >
      {b.brand}
    </span>
  );
}

function BrandStrip({
  brands,
  selected,
  onSelect,
}: {
  brands: BrandAttachRow[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Brand partners">
      {/* Monochrome wordmarks so every partner logo reads on either theme. */}
      <style>{`
        .cb-logo { filter: brightness(0) invert(1); }
        :root[data-theme="light"] .cb-logo { filter: brightness(0); }
      `}</style>
      {brands.map((b, i) => {
        const active = b.brand_id === selected;
        return (
          <motion.button
            key={b.brand_id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(b.brand_id)}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.3, delay: i * STAGGER, ease: ease.out }}
            className="v2-press relative flex h-11 shrink-0 items-center rounded-v2-md px-4"
          >
            {active && <ActiveIndicator layoutId="brand-attach-tab" className="rounded-v2-md border border-v2-border-strong bg-v2-surface-2" />}
            <span className="relative">
              <Wordmark b={b} active={active} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function BrandStats({ b }: { b: BrandAttachRow }) {
  const max = Math.max(b.in_crew_attach, b.out_crew_attach, 0.001) * 1.1;
  return (
    <div className="grid grid-cols-3 gap-4">
      <Stat label="Revenue" value={<Ticker value={b.branded_vc_revenue} format={fmtCompact} suffix="" />} sub="VC" />
      <Stat label="Attach" value={<Ticker value={b.attach_rate * 100} decimals={1} suffix="%" />} sub={`${fmtInt(b.buyers_n)} / ${fmtInt(b.exposed_n)}`} />
      <Stat
        label="Social"
        value={
          b.social_multiplier !== null ? (
            <Ticker value={b.social_multiplier} decimals={1} suffix={"\u00d7"} />
          ) : (
            <span className="text-v2-faint">n/a</span>
          )
        }
        sub={
          b.social_ci_low !== null && b.social_ci_high !== null
            ? `CI ${b.social_ci_low.toFixed(1)} to ${b.social_ci_high.toFixed(1)}`
            : "co-player bought"
        }
        accent
      />
      <div className="col-span-3 space-y-3">
        <AttachRow icon={<Users size={14} />} label="In a crew" v={b.in_crew_attach} n={b.in_crew_n} max={max} color="var(--accent)" delay={0.05} />
        <AttachRow icon={<User size={14} />} label="Solo" v={b.out_crew_attach} n={b.out_crew_n} max={max} color="var(--text-faint)" delay={0.17} />
      </div>
      <p className="col-span-3 text-[11px] text-v2-faint v2-tabular">
        {fmtPct(b.attach_with_neighbor)} attach when a co-player bought {b.brand} vs {fmtPct(b.attach_without_neighbor)} when none did
      </p>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-v2-faint">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold leading-none v2-tabular ${accent ? "text-v2-accent" : "text-v2-text"}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-v2-faint v2-tabular">{sub}</p>
    </div>
  );
}

function AttachRow({
  icon,
  label,
  v,
  n,
  max,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  v: number;
  n: number;
  max: number;
  color: string;
  delay: number;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr_56px] items-center gap-3 text-[12px]">
      <span className="flex items-center gap-1.5 text-v2-dim">
        {icon}
        {label}
      </span>
      <GrowBar value={v} max={max} color={color} delay={delay} height={8} />
      <span className="text-right text-v2-text v2-tabular" title={`n ${fmtInt(n)}`}>
        {fmtPct(v)}
      </span>
    </div>
  );
}

const TYPE_ICON: Record<string, typeof Shirt> = {
  SHOES: Footprints,
  JERSEY: Shirt,
  APPAREL: Shirt,
  ACCESSORY: Gem,
  BUNDLE: Package,
};

function ItemsRow({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; name: string; type: string; brand: string | null; price: number; meta: string }>;
}) {
  const reduce = useReducedMotion();
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-v2-faint">{title}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.slice(0, 5).map((it, i) => {
          const Icon = TYPE_ICON[it.type] || Package;
          return (
            <motion.div
              key={it.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(16px)" }}
              animate={{ opacity: 1, transform: "translateX(0px)" }}
              transition={{ duration: 0.4, delay: 0.15 + i * STAGGER, ease: ease.out }}
              className="w-[148px] shrink-0 rounded-v2-md border border-v2-border bg-v2-surface-2 p-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-v2-sm bg-v2-surface-3 text-v2-dim">
                <Icon size={15} strokeWidth={1.75} />
              </span>
              <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-v2-text">{it.name}</p>
              <p className="mt-1 text-[11px] text-v2-faint v2-tabular">
                {fmtInt(it.price)} VC · {it.meta}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default BrandAttachCard;
