# 2K Courtside — Design System & Motion Specification

**Product**: 2K Courtside — Audience Builder & Segmentation Engine (`TakeTwoPlayerGraph`)
**Aesthetic Direction**: Broadcast-grade NBA arena at night — court black (`#0A0A0C`), chalk white (`#F4F1EA`), official 2K red (`#EA2228`), warm maple hardwood (`#C8905A`), and label accents for Take-Two publishing labels (**2K**, **Rockstar Games**, **Zynga**).

---

## 1. Brand Color Tokens (`:root[data-brand="2k"]`)

| Token | Hex / Value | Purpose |
|---|---|---|
| `--court-black` | `#0A0A0C` | Primary arena canvas & background |
| `--court-ink` | `#121216` | Elevated panels, drawers, modals |
| `--court-line` | `rgba(255, 255, 255, 0.08)` | 1px hairline borders & dividers |
| `--chalk` | `#F4F1EA` | Primary display & body typography |
| `--chalk-dim` | `rgba(244, 241, 234, 0.62)` | Secondary copy, captions, axis labels |
| `--twok-red` | `#EA2228` | Official 2K logo SVG red · Primary CTA & NBA 2K27 accent |
| `--twok-red-deep` | `#AD171C` | Pressed state & deep red border tint |
| `--hardwood` | `#C8905A` | Warm maple court accent |
| `--vc-gold` | `#F5B400` | Virtual Currency (VC), spend, monetization & Gemini Pro badges |
| `--rockstar-gold` | `#FCAF17` | Rockstar Games label cluster & cross-label bridge edges |
| `--zynga-blue` | `#2F6FED` | Zynga label cluster & mobile bridge edges |
| `--win-green` | `#19C37D` | Live Spanner health, positive conversion lift, BUY verdict |
| `--loss-red` | `#FF4D5E` | Rage-Quit Index, churn risk, BOYCOTT verdict |

---

## 2. Typography Scale

Loaded via `next/font/google` (`Inter Tight`, `Inter`, `JetBrains Mono`):

| Role | Font Family | Tracking | Line Height | Weight | Notes |
|---|---|---|---|---|---|
| Display (`h1`–`h3`, `.text-display`) | `Inter Tight` | `-0.02em` | `1.05` | `600` | Broadcast headlines & hero counts |
| Title (`.text-title`) | `Inter Tight` | `-0.012em` | `1.20` | `600` | Panel & modal headers |
| Body (`.text-body`) | `Inter` | `0` | `1.50` | `400–500` | Readability-first copy |
| Caption (`.text-caption`) | `Inter` | `+0.06em` | `1.30` | `500` | Uppercase eyebrows & section headers |
| Tabular (`.tabular`, `.font-mono`) | `JetBrains Mono` | `0` | `1.35` | `400–600` | Mandatory `font-variant-numeric: tabular-nums` on all live numbers |

---

## 3. Motion Architecture & Easing Tokens

| Easing / Duration Token | Value | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Default enter/exit & press response |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Clip-path segmented indicator & layout shifts |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Apple sheet/drawer curve for right-hand drawers |
| `--dur-press` | `120ms` | `:active` `scale(0.97)` feedback |
| `--dur-tooltip` | `160ms` | Graph node hover tooltip |
| `--dur-dropdown` | `200ms` | Condition popover & GQL disclosure |
| `--dur-panel` | `260ms` | Modal materialization (`scale(0.96) -> 1`) |
| `--dur-drawer` | `320ms` | Entity Inspector, Creative Studio & Save Audience sheets |

### Strict Motion Restraint Rules
1. **No keyboard-initiated layout motion**: Typing in the Audience Builder or NL Search Bar never triggers layout shifts or bouncy animations.
2. **High-frequency telemetry rows never slide**: Live telemetry events in `LiveTelemetryTicker` and `ActivationFeed` insert in place with a 120ms opacity pulse (`0.6 -> 1`) on the newest row only.
3. **Never animate from `scale(0)`**: Modals and popovers enter from `scale(0.96)` or `translateY(8px)`.
4. **Never use `transition: all` or `ease-in`**: Explicit property lists (`transform`, `opacity`, `clip-path`, `filter`) only.
5. **Accessibility**: Full `@media (prefers-reduced-motion: reduce)`, `(prefers-reduced-transparency: reduce)`, and `(prefers-contrast: more)` support.

---

## 4. Shared Primitives (`src/components/brand/`)

- **`BrandLockup` & `LabelMark`**: Official 2K Courtside lockup and Take-Two label chips (`2K`, `ROCKSTAR`, `ZYNGA`).
- **`ModelBadge`**: Live Vertex AI model pill with humanized label and tabular latency readout.
- **`TabularNumber`**: Framer Motion `useMotionValue` + `useTransform` count-up that updates DOM text without per-frame React re-renders.
- **`HoldToConfirm`**: 1.4s linear `clip-path: inset()` hold-to-approve button with 180ms snap-back and Space/Enter keyboard support.
- **`GlassPanel`**: Translucent `.glass` / `.glass-heavy` surface with bright 1px top edge and optional `.hardwood-surface` grain.
- **`StaggerList`**: Assigns `--i` CSS custom property for 35ms staggered entrances.
- **`Sparkline`**: SVG area + line chart with 600ms `stroke-dashoffset` draw-in and optional peak/price callout.
- **`WaveformButton`**: HTML5 audio player with a 24-bar compositor-only (`transform: scaleY()`) waveform.
- **`CompareSlider`**: Pointer-captured before/after creative comparison slider driven by `clip-path: inset()`.
