/**
 * Deterministic radial layout for the Player 360 ego graph.
 *
 * Why not a force simulation: the hero moment is a choreographed reveal
 * (player -> pillars -> social), and a deterministic layout means every node
 * has a stable target the springs can travel to, re-centering is a pure
 * position diff, and nothing jitters while the presenter talks.
 *
 * Coordinate space: an SVG viewBox centred on the focal player at (0, 0).
 */
import type { P360EdgeKind, P360NodeKind, P360Pillar, Player360Response } from "@/lib/v2/player360";

export type Stage = "ego" | "pillars" | "social" | "metrics";

export const VIEW = { w: 1400, h: 960 } as const;
export const VIEWBOX = `${-VIEW.w / 2} ${-VIEW.h / 2} ${VIEW.w} ${VIEW.h}`;

export interface LNode {
  id: string;
  kind: P360NodeKind;
  pillar: P360Pillar;
  hop: 0 | 1 | 2;
  x: number;
  y: number;
  /** Where the node springs in from (its parent). */
  fromX: number;
  fromY: number;
  r: number;
  /** Seconds, used only when the node is entering. */
  stagger: number;
  label: string;
  sub?: string;
  showLabel: boolean;
  /** Label placement. Default "outside" (away from the centre). */
  labelPos?: "outside" | "below";
  /** Angle from centre (deg) used to place the label on the outside. */
  angle: number;
  churned?: boolean;
  churnedRecent?: boolean;
  keystone?: boolean;
  muted?: boolean;
  weight: number;
  clickable: boolean;
  /** Player id for neighbor nodes. */
  playerId?: string;
  tip: string[];
}

export interface LEdge {
  id: string;
  source: string;
  target: string;
  kind: P360EdgeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bow: number;
  weight: number;
  hop: 1 | 2;
  stagger: number;
  churned?: boolean;
  muted?: boolean;
}

export interface Layout {
  nodes: LNode[];
  edges: LEdge[];
}

const DEG = Math.PI / 180;

/** Pillar sector centres (deg; 0 = right, positive = clockwise in SVG). */
export const PILLAR_ANGLE: Record<"crew" | "creator" | "brand", number> = {
  crew: 180,
  creator: -50,
  brand: 50,
};

/** Where each pillar's caption sits in the pillars step (clear of the cluster). */
export const PILLAR_CAPTION: Record<"crew" | "creator" | "brand", { angle: number; r: number }> = {
  crew: { angle: 207, r: 350 },
  creator: { angle: -84, r: 330 },
  brand: { angle: 84, r: 330 },
};

const PILLAR_RADII = {
  wide: [205, 318, 425],
  tight: [168, 240, 306],
} as const;

const SOCIAL_RING = { rx: [505, 575], ry: [345, 398] } as const;
const HOP2_RING = { rx: 660, ry: 448 } as const;

function polar(deg: number, r: number): [number, number] {
  return [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
}

function ellipse(deg: number, rx: number, ry: number): [number, number] {
  return [Math.cos(deg * DEG) * rx, Math.sin(deg * DEG) * ry];
}

/** Spread n angles around `center` with at least `minArc` units between them at radius r. */
function arc(n: number, center: number, r: number, minArc = 44, maxHalf = 44): number[] {
  if (n <= 0) return [];
  if (n === 1) return [center];
  const step = (minArc / r) / DEG;
  const half = Math.min(maxHalf, (step * (n - 1)) / 2);
  const s = (2 * half) / (n - 1);
  return Array.from({ length: n }, (_, i) => center - half + i * s);
}

function shortDate(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "n/a";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function trim(s: string, n = 22): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function computeLayout(data: Player360Response, stage: Stage): Layout {
  const nodes: LNode[] = [];
  const edges: LEdge[] = [];
  const pos = new Map<string, LNode>();
  const centerId = `player:${data.player.player_id}`;

  const add = (n: LNode) => {
    nodes.push(n);
    pos.set(n.id, n);
  };
  const link = (
    id: string,
    source: string,
    target: string,
    kind: P360EdgeKind,
    weight: number,
    hop: 1 | 2,
    extra: Partial<LEdge> = {},
  ) => {
    const s = pos.get(source);
    const t = pos.get(target);
    if (!s || !t) return;
    edges.push({
      id,
      source,
      target,
      kind,
      x1: s.x,
      y1: s.y,
      x2: t.x,
      y2: t.y,
      bow: 0.08,
      weight,
      hop,
      stagger: t.stagger,
      ...extra,
    });
  };

  // ---- Centre -------------------------------------------------------------
  add({
    id: centerId,
    kind: "player",
    pillar: "center",
    hop: 0,
    x: 0,
    y: 0,
    fromX: 0,
    fromY: 0,
    r: 18,
    stagger: 0,
    label: data.player.gamer_tag,
    showLabel: false,
    angle: 0,
    keystone: data.player.keystone,
    weight: 1,
    clickable: false,
    playerId: data.player.player_id,
    tip: [data.player.gamer_tag],
  });

  if (stage === "ego") return { nodes, edges };

  const social = stage === "social" || stage === "metrics";
  const radii = social ? PILLAR_RADII.tight : PILLAR_RADII.wide;
  // When social blooms, pillars only move; their entrance stagger is for the pillars step.
  const pillarStagger = (pillarIdx: number, tier: number, i: number) =>
    social ? 0.04 * pillarIdx + 0.06 * tier + 0.015 * i : 0.1 * pillarIdx + 0.16 * tier + 0.045 * i;

  // ---- Crew pillar: Player -> Crew -> Match -> Season -------------------
  {
    const a0 = PILLAR_ANGLE.crew;
    const { crews, matches, seasons } = data.pillars.crew;
    const crewAngles = arc(crews.length, a0, radii[0], 54);
    crews.forEach((c, i) => {
      const [x, y] = polar(crewAngles[i], radii[0]);
      add({
        id: `crew:${c.clan_id}`,
        kind: "crew",
        pillar: "crew",
        hop: 1,
        x,
        y,
        fromX: 0,
        fromY: 0,
        r: c.is_active ? 13 : 9,
        stagger: pillarStagger(0, 0, i),
        label: trim(c.name),
        sub: c.is_active ? c.tier ?? undefined : "left",
        showLabel: true,
        labelPos: "below",
        angle: crewAngles[i],
        muted: !c.is_active,
        weight: c.crew_centrality ?? 0.5,
        clickable: false,
        tip: [
          c.name,
          [c.tier, c.role].filter(Boolean).join(" · "),
          c.crew_centrality !== null ? `centrality ${c.crew_centrality.toFixed(2)}` : "",
          c.member_count !== null ? `${c.member_count} members` : "",
          c.is_active ? "" : "former crew",
        ].filter(Boolean),
      });
      link(`e:mem:${c.clan_id}`, centerId, `crew:${c.clan_id}`, "MEMBER_OF", c.is_active ? 0.9 : 0.3, 1, {
        muted: !c.is_active,
      });
    });
    const matchAngles = arc(matches.length, a0, radii[1], 46);
    matches.forEach((m, i) => {
      const parent = pos.get(`crew:${m.clan_id}`);
      const [x, y] = polar(matchAngles[i], radii[1]);
      add({
        id: `match:${m.match_id}`,
        kind: "match",
        pillar: "crew",
        hop: 1,
        x,
        y,
        fromX: parent?.x ?? 0,
        fromY: parent?.y ?? 0,
        r: 7,
        stagger: pillarStagger(0, 1, i),
        label: [m.result, m.mode].filter(Boolean).join(" "),
        showLabel: !social,
        angle: matchAngles[i],
        churned: m.result === "L",
        weight: 0.5,
        clickable: false,
        tip: [
          `${m.mode ?? "Match"} ${m.result === "W" ? "win" : m.result === "L" ? "loss" : ""}`.trim(),
          m.score_diff !== null ? `${m.score_diff > 0 ? "+" : ""}${m.score_diff}` : "",
          shortDate(m.played_at) ?? "",
        ].filter(Boolean),
      });
      link(`e:cmp:${m.match_id}`, `crew:${m.clan_id}`, `match:${m.match_id}`, "COMPETED_IN", 0.45, 1);
    });
    const seasonAngles = arc(seasons.length, a0, radii[2], 60);
    seasons.forEach((s, i) => {
      const [x, y] = polar(seasonAngles[i], radii[2]);
      const firstMatch = matches.find((m) => m.season_id === s.season_id);
      const parent = firstMatch ? pos.get(`match:${firstMatch.match_id}`) : undefined;
      add({
        id: `season:${s.season_id}`,
        kind: "season",
        pillar: "crew",
        hop: 1,
        x,
        y,
        fromX: parent?.x ?? x * 0.7,
        fromY: parent?.y ?? y * 0.7,
        r: 10,
        stagger: pillarStagger(0, 2, i),
        label: trim(s.name.replace(/^NBA 2K\d+\s*/i, ""), 18),
        showLabel: true,
        angle: seasonAngles[i],
        weight: 0.6,
        clickable: false,
        tip: [s.name],
      });
      matches
        .filter((m) => m.season_id === s.season_id)
        .forEach((m) => link(`e:ssn:${m.match_id}`, `match:${m.match_id}`, `season:${s.season_id}`, "IN_SEASON", 0.3, 1));
    });
  }

  // ---- Creator pillar: Player -> ViewerAccount -> Stream <- Creator -------
  {
    const a0 = PILLAR_ANGLE.creator;
    const { accounts, streams, creators } = data.pillars.creator;
    const accAngles = arc(accounts.length, a0, radii[0], 44);
    accounts.forEach((acc, i) => {
      const [x, y] = polar(accAngles[i], radii[0]);
      add({
        id: `account:${acc.identity_id}`,
        kind: "account",
        pillar: "creator",
        hop: 1,
        x,
        y,
        fromX: 0,
        fromY: 0,
        r: 9,
        stagger: pillarStagger(1, 0, i),
        label: acc.platform,
        showLabel: !social && i < 3,
        angle: accAngles[i],
        weight: 0.6,
        clickable: false,
        tip: [acc.platform, acc.handle ?? ""].filter(Boolean),
      });
      link(`e:lnk:${acc.identity_id}`, centerId, `account:${acc.identity_id}`, "LINKED_TO", 0.6, 1);
    });
    // Order streams by their account so edges fan without crossing.
    const accIndex = new Map(accounts.map((a, i) => [a.identity_id, i]));
    const ordered = [...streams].sort((a, b) => (accIndex.get(a.identity_id) ?? 0) - (accIndex.get(b.identity_id) ?? 0));
    const stAngles = arc(ordered.length, a0, radii[1], 40);
    ordered.forEach((st, i) => {
      const parent = pos.get(`account:${st.identity_id}`);
      const [x, y] = polar(stAngles[i], radii[1]);
      add({
        id: `stream:${st.stream_id}`,
        kind: "stream",
        pillar: "creator",
        hop: 1,
        x,
        y,
        fromX: parent?.x ?? 0,
        fromY: parent?.y ?? 0,
        r: 6 + Math.min(4, st.watch_minutes / 30),
        stagger: pillarStagger(1, 1, i),
        label: trim(st.title, 18),
        showLabel: false,
        angle: stAngles[i],
        weight: Math.min(1, st.watch_minutes / 90),
        clickable: false,
        tip: [st.title, `${Math.round(st.watch_minutes)} min watched`, st.peak_viewers ? `${compact(st.peak_viewers)} peak` : ""].filter(Boolean),
      });
      link(`e:wat:${st.stream_id}`, `account:${st.identity_id}`, `stream:${st.stream_id}`, "WATCHED", Math.min(1, st.watch_minutes / 90), 1);
    });
    const crIdx = (cid: string) => {
      const idxs = ordered.map((s, i) => (s.creator_id === cid ? i : -1)).filter((i) => i >= 0);
      return idxs.length ? idxs.reduce((a, b) => a + b, 0) / idxs.length : 0;
    };
    const orderedCreators = [...creators].sort((a, b) => crIdx(a.creator_id) - crIdx(b.creator_id));
    const crAngles = arc(orderedCreators.length, a0, radii[2], 58);
    orderedCreators.forEach((cr, i) => {
      const firstStream = ordered.find((s) => s.creator_id === cr.creator_id);
      const parent = firstStream ? pos.get(`stream:${firstStream.stream_id}`) : undefined;
      const [x, y] = polar(crAngles[i], radii[2]);
      add({
        id: `creator:${cr.creator_id}`,
        kind: "creator",
        pillar: "creator",
        hop: 1,
        x,
        y,
        fromX: parent?.x ?? x * 0.7,
        fromY: parent?.y ?? y * 0.7,
        r: 11,
        stagger: pillarStagger(1, 2, i),
        label: trim(cr.handle, 16),
        showLabel: true,
        angle: crAngles[i],
        weight: cr.hub_score ?? 0.5,
        clickable: false,
        tip: [cr.handle, cr.followers ? `${compact(cr.followers)} followers` : "", cr.hub_score !== null ? `hub ${cr.hub_score.toFixed(2)}` : ""].filter(Boolean),
      });
      ordered
        .filter((s) => s.creator_id === cr.creator_id)
        .forEach((s) => link(`e:hst:${s.stream_id}`, `stream:${s.stream_id}`, `creator:${cr.creator_id}`, "HOSTED", 0.45, 1));
    });
  }

  // ---- Brand pillar: Player -> Item <- Activation <- Brand ----------------
  {
    const a0 = PILLAR_ANGLE.brand;
    const { items, activations, brands } = data.pillars.brand;
    const itAngles = arc(items.length, a0, radii[0], 36);
    items.forEach((it, i) => {
      const [x, y] = polar(itAngles[i], radii[0]);
      add({
        id: `item:${it.item_id}`,
        kind: "item",
        pillar: "brand",
        hop: 1,
        x,
        y,
        fromX: 0,
        fromY: 0,
        r: it.is_branded ? 9 : 7,
        stagger: pillarStagger(2, 0, i),
        label: trim(it.name, 18),
        showLabel: false,
        angle: itAngles[i],
        weight: it.is_branded ? 0.8 : 0.4,
        clickable: false,
        tip: [
          it.name,
          [it.item_type, it.vc_price !== null ? `${compact(it.vc_price)} VC` : null].filter(Boolean).join(" · "),
          [it.bought ? "bought" : null, it.equipped ? "equipped" : null].filter(Boolean).join(" · "),
        ].filter(Boolean),
      });
      link(`e:buy:${it.item_id}`, centerId, `item:${it.item_id}`, it.bought ? "BOUGHT" : "EQUIPPED", it.equipped ? 0.8 : 0.5, 1);
    });
    const actAngles = arc(activations.length, a0, radii[1], 50);
    activations.forEach((a, i) => {
      const firstItem = a.item_ids.map((id) => pos.get(`item:${id}`)).find(Boolean);
      const [x, y] = polar(actAngles[i], radii[1]);
      add({
        id: `activation:${a.activation_id}`,
        kind: "activation",
        pillar: "brand",
        hop: 1,
        x,
        y,
        fromX: firstItem?.x ?? 0,
        fromY: firstItem?.y ?? 0,
        r: 8,
        stagger: pillarStagger(2, 1, i),
        label: trim(a.title, 18),
        showLabel: !social,
        angle: actAngles[i],
        weight: 0.6,
        clickable: false,
        tip: [a.title, (a.kind ?? "").replace(/_/g, " ").toLowerCase()].filter(Boolean),
      });
      a.item_ids.forEach((iid) => link(`e:fea:${a.activation_id}:${iid}`, `activation:${a.activation_id}`, `item:${iid}`, "FEATURES", 0.45, 1));
    });
    const brAngles = arc(brands.length, a0, radii[2], 62);
    brands.forEach((b, i) => {
      const act = activations.find((a) => a.brand_id === b.brand_id);
      const item = items.find((it) => it.brand_id === b.brand_id);
      const parent = act ? pos.get(`activation:${act.activation_id}`) : item ? pos.get(`item:${item.item_id}`) : undefined;
      const [x, y] = polar(brAngles[i], radii[2]);
      add({
        id: `brand:${b.brand_id}`,
        kind: "brand",
        pillar: "brand",
        hop: 1,
        x,
        y,
        fromX: parent?.x ?? x * 0.7,
        fromY: parent?.y ?? y * 0.7,
        r: 12,
        stagger: pillarStagger(2, 2, i),
        label: trim(b.name, 16),
        showLabel: true,
        angle: brAngles[i],
        weight: 0.8,
        clickable: false,
        tip: [b.name, b.category ?? ""].filter(Boolean),
      });
      const acts = activations.filter((a) => a.brand_id === b.brand_id);
      acts.forEach((a) => link(`e:spn:${a.activation_id}`, `brand:${b.brand_id}`, `activation:${a.activation_id}`, "SPONSORS", 0.5, 1));
      // Branded items with no rendered activation still hang off their brand.
      items
        .filter((it) => it.brand_id === b.brand_id && !acts.some((a) => a.item_ids.includes(it.item_id)))
        .forEach((it) => link(`e:mad:${it.item_id}`, `brand:${b.brand_id}`, `item:${it.item_id}`, "MADE_BY", 0.25, 1, { muted: true }));
    });
  }

  if (!social) return { nodes, edges };

  // ---- Social ring ----------------------------------------------------------
  const neighbors = data.social.nodes.filter((n) => n.hop === 1 && n.kind === "neighbor");
  const sameCrew = neighbors.filter((n) => n.same_crew).sort((a, b) => b.weight - a.weight);
  const others = neighbors.filter((n) => !n.same_crew).sort((a, b) => b.weight - a.weight);
  const ordered = [...sameCrew, ...others];
  const N = ordered.length;
  const step = N ? 360 / N : 0;
  // Centre the same-crew block on the crew pillar side.
  const start = PILLAR_ANGLE.crew - ((sameCrew.length - 1) / 2) * step;
  const strongest = new Set(
    [...neighbors].sort((a, b) => b.weight - a.weight).slice(0, 6).map((n) => n.id),
  );
  // Bloom order: strongest ties first.
  const bloomRank = new Map([...neighbors].sort((a, b) => b.weight - a.weight).map((n, i) => [n.id, i]));
  const neighborAngle = new Map<string, number>();
  ordered.forEach((n, i) => {
    const ang = start + i * step;
    const ring = i % 2;
    const [x, y] = ellipse(ang, SOCIAL_RING.rx[ring], SOCIAL_RING.ry[ring]);
    neighborAngle.set(n.id, ang);
    const rank = bloomRank.get(n.id) ?? i;
    const pid = n.id.replace(/^player:/, "");
    add({
      id: n.id,
      kind: "neighbor",
      pillar: "social",
      hop: 1,
      x,
      y,
      fromX: x * 0.22,
      fromY: y * 0.22,
      r: 4.5 + 7 * n.weight,
      stagger: (stage === "social" ? 0.1 : 0) + rank * 0.022,
      label: trim(n.label, 16),
      sub: n.sub,
      showLabel: strongest.has(n.id) || !!n.keystone,
      angle: ang,
      churned: n.churned,
      churnedRecent: n.churned_recent,
      keystone: n.keystone,
      weight: n.weight,
      clickable: true,
      playerId: pid,
      tip: [
        n.label,
        n.sub ? `crew ${n.sub}` : "",
        n.churned_recent ? "churned in last 14d" : n.churned ? "churned" : `churn risk ${Math.round((n.churn_risk ?? 0) * 100)}%`,
        n.keystone ? "keystone" : "",
        `tie ${n.weight.toFixed(2)}`,
      ].filter(Boolean),
    });
  });

  const neighborLinks = data.social.links.filter((l) => l.hop === 1);
  for (const l of neighborLinks) {
    const t = pos.get(l.target);
    if (!t) continue;
    const bow = l.kind === "PLAYED_WITH" ? 0.04 : l.kind === "FRIENDS_WITH" ? 0.11 : -0.09;
    link(l.id, l.source, l.target, l.kind, l.weight, 1, { bow, churned: t.churned });
  }

  // ---- Hop 2: neighbors' crews / creators / brands --------------------------
  const hop2 = data.social.nodes.filter((n) => n.hop === 2);
  if (hop2.length) {
    const hop2Links = data.social.links.filter((l) => l.hop === 2);
    const placed = hop2
      .map((n) => {
        const angs = hop2Links
          .filter((l) => l.target === n.id)
          .map((l) => neighborAngle.get(l.source))
          .filter((a): a is number => a !== undefined);
        // Circular mean of connected neighbours.
        const sx = angs.reduce((s, a) => s + Math.cos(a * DEG), 0);
        const sy = angs.reduce((s, a) => s + Math.sin(a * DEG), 0);
        const ang = angs.length ? Math.atan2(sy, sx) / DEG : 0;
        return { n, ang };
      })
      .sort((a, b) => a.ang - b.ang);
    // Relax to a minimum angular separation so labels do not stack.
    const MIN_SEP = 360 / Math.max(placed.length, 1) < 11 ? 360 / placed.length : 11;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < placed.length; i++) {
        if (placed[i].ang - placed[i - 1].ang < MIN_SEP) placed[i].ang = placed[i - 1].ang + MIN_SEP;
      }
    }
    placed.forEach(({ n, ang }, i) => {
      const [x, y] = ellipse(ang, HOP2_RING.rx, HOP2_RING.ry);
      const pillar = n.pillar;
      add({
        id: n.id,
        kind: n.kind,
        pillar,
        hop: 2,
        x,
        y,
        fromX: x * 0.8,
        fromY: y * 0.8,
        r: 5 + 4 * n.weight,
        stagger: (stage === "social" ? 1.0 : 0) + i * 0.03,
        label: trim(n.label, 14),
        sub: n.sub,
        showLabel: (n.degree ?? 0) >= 2,
        angle: ang,
        weight: n.weight,
        clickable: false,
        tip: [n.label, n.sub ?? "", `${n.degree ?? 0} of your neighbors`].filter(Boolean),
      });
    });
    for (const l of hop2Links) link(l.id, l.source, l.target, l.kind, l.weight, 2, { bow: 0.05 });
  }

  return { nodes, edges };
}

/** Quadratic arc between two points, bowed perpendicular to the chord. */
export function edgePath(x1: number, y1: number, x2: number, y2: number, bow: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx - (y2 - y1) * bow;
  const cy = my + (x2 - x1) * bow;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
