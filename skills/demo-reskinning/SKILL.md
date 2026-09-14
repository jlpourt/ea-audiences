---
name: demo-reskinning
description: >-
  Comprehensive guide and operational runbook for reskinning enterprise AI demos from one customer
  or company to another (e.g., EA to Activision Blizzard King, healthcare to fintech, retail to telecom).
  Covers brand identity & dynamic CSS token theming, customer value profiling (what they care about more vs less),
  synthetic database & graph re-seeding, media/generative asset reproduction (Gemini/Imagen/video),
  tailored AI agent prompts & synthetic focus groups, and zero-leak audit validation.
---

# Enterprise Demo Reskinning & Customer Personalization

> "A demo doesn't close a deal because it works; it closes a deal because the customer sees their own reflection in it so clearly that returning to their current workflow feels like a downgrade."

When presenting an enterprise technology platform to a new customer or prospect, a generic demo or one carrying another company's trademarks, data models, or terminology immediately breaks immersion. A truly persuasive reskin is not a superficial logo replacement; it is a **deep contextual translation** across five architectural layers:
1. **Brand Identity & Theming** (Logos, color tokens, typography, aesthetic posture)
2. **Customer Value Profiling** (What they obsess over vs what to de-emphasize)
3. **Synthetic Database & Graph Personalization** (Franchises, entities, telemetry distributions)
4. **Generative Media Assets** (Authentic IP artwork, hero imagery, streaming video)
5. **Agent Persona & Cognitive Grounding** (Prompts, focus group cohorts, golden query paths)

---

## 1. Customer Value Profiling: What They Care About More vs Less

Before writing code or generating images, create a **Customer Value Profile**. Different companies within the same vertical have drastically different corporate cultures, monetization priorities, organizational structures, and strategic pain points.

### The Contrast Framework (Example: Electronic Arts vs Activision Blizzard King)

| Dimension | Origin Customer: Electronic Arts (EA) | Target Customer: Activision Blizzard King (ABK) |
| :--- | :--- | :--- |
| **Flagship Franchises** | EA SPORTS FC, Apex Legends, Madden NFL, Battlefield, The Sims | Call of Duty (Warzone / Mobile), World of Warcraft, Diablo IV, Overwatch 2, Candy Crush Saga |
| **Monetization Focus** | Ultimate Team card packs, annual sports releases, cosmetic battle passes | Hybrid ecosystem: F2P Battle Passes (CoD), Box + Battle Pass (Diablo), Monthly MMO Subscription (WoW), Casual Mobile Microtransactions (King) |
| **Ecosystem Glue** | EA App, EA Play subscription, cross-play progression | **Battle.net** unified launcher, Xbox / Microsoft cross-synergies, King mobile ad network |
| **Critical Metric Focus** | Churn after annual sports launch cycle, loss-streak rage quitting ("tilt index"), creator stream conversion | **Franchise cross-pollination** (CoD to Diablo), Battle Pass tier-skips, mobile-to-PC account linking, live-event server concurrency |
| **Cultural Lexicon** | "Clubs", "FUT Champions", "Pack Openings", "Legends", "Simmers" | "Seasons", "Raids", "Loadouts", "Prestige", "Battle.net ID", "Gold sinks", "King Boosters" |
| **Sensitive Pain Points** | Loot box regulation, server tick rates during Weekend League | Battle pass XP pacing, cross-play PC anti-cheat (Ricochet), microtransaction pricing backlash |

### Profiling Questions to Answer for Any New Customer

1. **What is their primary revenue engine?**
   * *Subscription / ARR*: Focus on retention cliffs, renewal forecasting, seat utilization.
   * *Transactional / Live-Ops*: Focus on average revenue per daily active user (ARPDAU), conversion funnels, whale cohort protection.
   * *Usage-based / Infrastructure*: Focus on query latency, compute cost optimization, throughput bottlenecks.
2. **Who is in the room for the demo?**
   * *Executive (C-Suite / VP)*: Cares about high-level ROI, cross-portfolio LTV, macro retention graphs, time-to-market reduction.
   * *Studio GM / Product Director*: Cares about feature adoption, player sentiment velocity, live-ops campaign dispatch, A/B test confidence.
   * *Data / Engineering Lead*: Cares about schema elegance (Spanner Graph, BigQuery), real-time query latencies, API schemas, security/governance.
3. **What features should be elevated vs hidden?**
   * **Elevate**: Modules directly solving their publicly acknowledged challenges or recent strategic investments.
   * **Re-label**: General features mapped to their exact internal terminology.
   * **Silence / Remove**: Irrelevant workflows that distract from their core business model (e.g., hide casual mobile ad-network metrics when pitching a hardcore PC MMO studio).

---

## 2. Visual Identity & Dynamic Token Theming

Never hardcode brand colors, hex codes, or customer names inside presentation components. Build a **Tenant Token System** driven by CSS variables and a single brand manifest.

### Dynamic Token Architecture

Structure your Tailwind or CSS theme to consume custom CSS variables:

```css
/* globals.css */
:root[data-brand="ea"] {
  --brand-primary: 220 90% 56%;       /* EA Electric Blue */
  --brand-primary-hover: 220 90% 48%;
  --brand-accent: 142 76% 50%;        /* Pitch Green (FC 25) */
  --brand-surface: 224 71% 4%;        /* Deep Navy Night */
  --brand-card: 224 50% 8%;
  --brand-border: 224 40% 16%;
  --brand-text: 210 40% 98%;
  --brand-glow: rgba(59, 130, 246, 0.25);
  --brand-font-family: 'Inter', system-ui, sans-serif;
  --brand-radius: 0.75rem;
}

:root[data-brand="abk"] {
  --brand-primary: 38 92% 50%;        /* Blizzard Radiant Amber / Battle.net Gold */
  --brand-primary-hover: 38 92% 42%;
  --brand-accent: 199 89% 48%;        /* Battle.net Arcane Cyan */
  --brand-surface: 240 10% 4%;        /* Dark Charcoal Obsidian */
  --brand-card: 240 8% 8%;
  --brand-border: 240 6% 18%;
  --brand-text: 0 0% 98%;
  --brand-glow: rgba(245, 158, 11, 0.25);
  --brand-font-family: 'Rajdhani', 'Inter', sans-serif;
  --brand-radius: 0.375rem;           /* Sharper, tactical edges */
}
```

In `tailwind.config.js`:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'hsl(var(--brand-primary) / <alpha-value>)',
          'primary-hover': 'hsl(var(--brand-primary-hover) / <alpha-value>)',
          accent: 'hsl(var(--brand-accent) / <alpha-value>)',
          surface: 'hsl(var(--brand-surface) / <alpha-value>)',
          card: 'hsl(var(--brand-card) / <alpha-value>)',
          border: 'hsl(var(--brand-border) / <alpha-value>)',
        },
      },
      boxShadow: {
        'brand-glow': '0 0 25px -5px var(--brand-glow)',
      },
    },
  },
};
```

### Logo & Favicon Standardization

Maintain a strict directory structure for client identity assets:

```
public/
└── brands/
    ├── ea/
    │   ├── logo-full.svg       (Full horizontal lockup with text)
    │   ├── logo-mark.svg       (Square/circular icon only)
    │   ├── favicon.svg
    │   └── watermark.png
    └── abk/
        ├── logo-full.svg
        ├── logo-mark.svg
        ├── favicon.svg
        └── watermark.png
```

* Rules for Logo Replacements:
  * **Always use vector SVGs** for crisp rendering on high-DPI displays.
  * Check both **Dark Mode** and **Light Mode** contrast. Ensure light brand marks have a translucent dark backing if placed over game photography.
  * Update `<title>` and Open Graph meta tags in your app root layout:
    ```tsx
    export function generateMetadata() {
      const brand = getActiveBrand();
      return {
        title: `${brand.displayName} | Intelligence Command Center`,
        icons: { icon: brand.logos.favicon },
      };
    }
    ```

---

## 3. Database & Graph Telemetry Personalization

A customer spots fake or foreign data within 3 seconds. To make the data visceral, the database must accurately reflect their **catalogs, user hierarchies, regional segments, and transaction models**.

### 1. Schema Adaptation Blueprint

When adapting a property graph (e.g., Spanner Graph, Neo4j) or relational warehouse (BigQuery):

* **Entity Nodes**:
  * Old: `(:Publisher {name: 'Electronic Arts'})`
  * New: `(:Publisher {name: 'Activision Blizzard King'})`
* **Sub-studios / Divisions**:
  * Old: `EA Vancouver`, `Respawn Entertainment`, `DICE`, `Maxis`, `BioWare`
  * New: `Infinity Ward`, `Treyarch`, `Blizzard Entertainment`, `King`, `Sledgehammer Games`
* **Franchise Nodes**:
  * Old: `Apex Legends`, `EA SPORTS FC 25`, `Madden NFL 25`, `Battlefield 2042`, `The Sims 4`
  * New: `Call of Duty: Warzone`, `World of Warcraft`, `Diablo IV`, `Overwatch 2`, `Candy Crush Saga`
* **Telemetry Trait Edges**:
  * Old: `loss_streak_tilt`, `fut_pack_affinity`, `ea_play_subscriber`
  * New: `battle_pass_progression_cliff`, `ricochet_report_flag`, `battlenet_cross_title_gravity`, `mobile_booster_depletion`

### 2. Concrete Database Re-seeding Pipeline

Always provide a single CLI command to reset and re-seed databases:

```bash
# Example invocation
python scripts/seed_brand_data.py --brand=abk --records=5000 --flush
```

```python
# scripts/seed_brand_data.py snippet
BRAND_TAXONOMIES = {
    "abk": {
        "publisher": "Activision Blizzard King",
        "studios": ["Infinity Ward", "Treyarch", "Blizzard Team 1", "King London"],
        "titles": [
            {"id": "cod_warzone", "name": "Call of Duty: Warzone", "genre": "Battle Royale / FPS"},
            {"id": "wow_retail", "name": "World of Warcraft: The War Within", "genre": "MMORPG"},
            {"id": "diablo_4", "name": "Diablo IV: Vessel of Hatred", "genre": "Action RPG"},
            {"id": "overwatch_2", "name": "Overwatch 2", "genre": "Hero Shooter"},
            {"id": "candy_crush", "name": "Candy Crush Saga", "genre": "Match-3 Mobile"},
        ],
        "friction_events": [
            "Ricochet Shadowban Suspect",
            "Mythic Raid Progression Wall",
            "Pit Tier 80 One-Shot Churn",
            "Battle Pass Sector 18 Fatigue",
            "Level 1540 Out-of-Lives Friction"
        ],
        "offers": [
            "BlackCell Season Bundle",
            "6-Month Mount Subscription",
            "Infernal Armor Pack ($19.99)",
            "Gold Booster Pack ($4.99)"
        ]
    }
}
```

### 3. Realistic Synthetic Distributions

Don't use uniform random distributions. Mimic industry realities:
* **80/20 Rule on Spend**: 5% of players account for 65% of microtransaction revenue ("whales").
* **Platform Segments**: Call of Duty should skew 60% Console / 40% PC, World of Warcraft 100% PC, Candy Crush 95% Mobile.
* **Telemetry Correlations**: A high "Raid Wipe Count" in WoW should correlate with "Sub Cancellation Risk"; a "Hardcore SBMM Match Loss Streak" in Warzone correlates with "Session Drop-off".

---

## 4. Generative Media & Asset Production (Images, Video, Sound)

Stock photos or mismatched assets ruin immersion. Use Vertex AI Gemini, Imagen 3, or generative pipelines to produce high-resolution assets formatted specifically for the UI.

### 1. Image Prompt Engineering Template

Use exact, repeatable prompt formulas to generate franchise assets:

```text
[Subject & Character Description], [Action or Posture], [Key Franchise Elements/Weapons/Gear], 
[Lighting: e.g., volumetric rim light, cinematic golden hour, or dark gothic atmosphere], 
[Background environment: iconic game map or landscape], 
[Style: Photorealistic 8K render, Unreal Engine 5 cinematic, or stylized Blizzard matte painting], 
--ar [Aspect Ratio: 16:9 for hero banner, 1:1 for squad card, 4:5 for mobile promo]
```

#### Example Prompts for ABK Franchises:
* **Call of Duty: Warzone**:
  > *"Tactical special forces operator in modern night-vision goggles holding a suppressed assault rifle, crouching on a rain-slicked Verdansk rooftop at dusk, cinematic blue and amber rim lighting, rain droplets on tactical vest, 8k resolution, photorealistic Unreal Engine 5 render --ar 16:9"*
* **Diablo IV**:
  > *"Gothic dark fantasy Necromancer commanding ethereal glowing bone armor, surrounded by dark crimson mist in a ruined sanctuary cathedral, candlelit moody lighting, highly detailed Blizzard cinematic style --ar 16:9"*
* **World of Warcraft**:
  > *"High fantasy armored Paladin with radiant glowing golden hammer standing before the towering gates of Dornogal, vibrant skies, stylized Warcraft cinematic aesthetic, hyper-detailed armor textures --ar 16:9"*

### 2. Media Aspect Ratio & Delivery Matrix

| Placement | Dimensions | Aspect Ratio | Format | File Size Limit |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Background Banner** | 1920x1080 / 2560x1440 | 16:9 | WebP / MP4 Loop | < 800 KB (WebP) / < 4 MB (MP4) |
| **Franchise Card Preview** | 800x450 | 16:9 | WebP | < 120 KB |
| **Player / Persona Avatar** | 256x256 | 1:1 | WebP / PNG | < 40 KB |
| **Mobile Offer Creative** | 1080x1920 | 9:16 | WebP | < 350 KB |

---

## 5. Agent Personalization & Synthetic Focus Groups

When the demo includes conversational agents or persona simulators (like DeepSona focus groups):

### 1. System Prompt Personalization

Give the LLM deep domain knowledge of the target company:

```python
SYSTEM_PROMPT = f"""
You are the Chief Player Intelligence AI for {brand.display_name}.
You have direct access to real-time player telemetry across {', '.join([t['name'] for t in brand.titles])}.

Tone & Posture:
- Executive, analytical, data-driven, and highly attuned to player community sentiment.
- Use native {brand.display_name} terminology: refer to Battle.net, Season Pass sectors, Mythic+ keystones, and King live-ops.
- Never confuse franchises from other publishers (do not mention FIFA, Apex Legends, or Ultimate Team).
- When analyzing churn or sentiment, cite specific telemetry markers: loss streaks, server latency spikes, battle pass completion rates, and forum backlash.
"""
```

### 2. Persona Focus Group Adaptation

Customize the synthetic consumer focus groups to reflect the customer's actual community sub-cultures:

* **For EA**:
  * *The Weekend League Grinder* (High spend, highly critical of gameplay tuning)
  * *The Casual Career Mode Builder* (Prefers offline progression, price-sensitive)
  * *The Apex Predator Streamer Fan* (Influenced by Twitch/YouTube creators)
* **For ABK**:
  * *The Hardcore CoD Camo Grinder* (Tracks weapon TTK, hates aggressive SBMM, buys BlackCell)
  * *The 20-Year WoW Guild Leader* (Cares about raid balance, subscription value, addon support)
  * *The Casual Commuter Match-3 Player* (High daily frequency, zero tolerance for forced ads, buys extra moves)

### 3. Golden Demo Queries

Pre-populate the UI with instant "suggestion chips" or canned queries that highlight the customer's most strategic business questions:

```typescript
// Sample suggestion chips for ABK
export const DEMO_QUERY_PRESETS = [
  "Predict churn risk for players who failed Pit Tier 60 three times in Diablo IV",
  "Simulate Reddit community reaction to increasing Season 5 BlackCell price by $5",
  "Find high-value Battle.net players who are active in Warzone but haven't tried WoW: The War Within",
  "Analyze Candy Crush Level 1500+ spend drop-off after the latest booster rebalance"
];
```

---

## 6. Architecture for Zero-Downtime Tenant Switching

To avoid maintaining separate branches for every customer pitch, build a **Config-Driven Multi-Tenant Architecture**.

### 1. The Central Brand Manifest (`brand.config.ts`)

```typescript
// src/config/brand.config.ts
export interface Franchise {
  id: string;
  name: string;
  category: string;
  heroImage: string;
  logoMark: string;
  primaryMetric: string;
}

export interface BrandConfig {
  id: string;
  displayName: string;
  tagline: string;
  logos: {
    full: string;
    mark: string;
    favicon: string;
  };
  themeId: string;
  database: {
    spannerDb: string;
    bigQueryDataset: string;
  };
  franchises: Franchise[];
  defaultPrompts: string[];
}

export const BRANDS: Record<string, BrandConfig> = {
  ea: {
    id: "ea",
    displayName: "Electronic Arts",
    tagline: "Live Services Player Intelligence Studio",
    logos: {
      full: "/brands/ea/logo-full.svg",
      mark: "/brands/ea/logo-mark.svg",
      favicon: "/brands/ea/favicon.svg",
    },
    themeId: "ea",
    database: {
      spannerDb: "ea_graph_db",
      bigQueryDataset: "ea_marketing_intelligence",
    },
    franchises: [
      { id: "fc25", name: "EA SPORTS FC 25", category: "Sports", heroImage: "/brands/ea/fc25.webp", logoMark: "/brands/ea/fc_mark.svg", primaryMetric: "FUT Pack Margin" },
      { id: "apex", name: "Apex Legends", category: "Battle Royale", heroImage: "/brands/ea/apex.webp", logoMark: "/brands/ea/apex_mark.svg", primaryMetric: "Ranked Retention" }
    ],
    defaultPrompts: [
      "Analyze tilt index for Apex players on a 5-match loss streak",
      "Model FUT Champions pack discount backlash on r/EASportsFC"
    ]
  },
  abk: {
    id: "abk",
    displayName: "Activision Blizzard King",
    tagline: "Unified Franchise Intelligence & LiveOps Command",
    logos: {
      full: "/brands/abk/logo-full.svg",
      mark: "/brands/abk/logo-mark.svg",
      favicon: "/brands/abk/favicon.svg",
    },
    themeId: "abk",
    database: {
      spannerDb: "abk_graph_db",
      bigQueryDataset: "abk_marketing_intelligence",
    },
    franchises: [
      { id: "warzone", name: "Call of Duty: Warzone", category: "Action FPS", heroImage: "/brands/abk/warzone.webp", logoMark: "/brands/abk/cod_mark.svg", primaryMetric: "BlackCell Conversion" },
      { id: "wow", name: "World of Warcraft", category: "MMORPG", heroImage: "/brands/abk/wow.webp", logoMark: "/brands/abk/wow_mark.svg", primaryMetric: "6-Month Sub Renewal" },
      { id: "diablo", name: "Diablo IV", category: "Action RPG", heroImage: "/brands/abk/diablo.webp", logoMark: "/brands/abk/diablo_mark.svg", primaryMetric: "Season Pass Completion" },
      { id: "candycrush", name: "Candy Crush Saga", category: "Casual Mobile", heroImage: "/brands/abk/candycrush.webp", logoMark: "/brands/abk/candy_mark.svg", primaryMetric: "Booster Depletion LTV" }
    ],
    defaultPrompts: [
      "Identify Warzone players who have an active Battle.net account but haven't played Diablo IV",
      "Simulate Discord focus group feedback for a $20 WoW cross-franchise transmog mount"
    ]
  }
};

export function getActiveBrand(): BrandConfig {
  const brandKey = process.env.NEXT_PUBLIC_BRAND || "abk";
  return BRANDS[brandKey] || BRANDS["abk"];
}
```

---

## 7. The Zero-Leak Audit & Pre-Flight Checklist

Before putting the reskinned demo in front of clients or stakeholders, execute this mandatory audit:

### 1. Automated Grep Audit Script

Run this command from your terminal to verify that no legacy brand strings remain in your source code:

```bash
# Search for legacy customer strings (e.g. searching for EA relics when pitching ABK)
grep -rnEi "electronic arts|\bea\b|ea sports|apex legends|battlefield|the sims|madden|fifa" \
  src/ data/ scripts/ public/ \
  --exclude-dir={.git,node_modules,.next}
```

### 2. Pre-Flight Verification Checklist

- [ ] **Tab Title & Favicon**: Verify the browser tab displays the target company's name and favicon, not the previous client or framework default ("React App" or "Next.js").
- [ ] **Header & Navigation**: Check logo clarity, aspect ratio, and absence of visual clipping on 1080p, 1440p, and MacBook Retina screens.
- [ ] **Data Table Scrutiny**: Inspect column headers, foreign keys, and tooltips. Ensure mock user IDs match the customer's convention (e.g., `BNET#12485` instead of `EA_ID_9921`).
- [ ] **Currency & Pricing**: Ensure currency symbols and pricing models match their territory and standard monetization tiers (e.g., $9.99 Season Pass vs $14.99/mo subscription).
- [ ] **AI Chat Responses**: Ask the AI copilot 3 test questions to ensure it never mentions the previous client or displays outdated system prompt instructions.
- [ ] **Network / DevTools Tab**: Inspect the Network tab to ensure no 404s on asset URLs and no third-party CDN endpoints revealing the previous company's private buckets.
- [ ] **Error States & Empty States**: Trigger an empty search or an error message to confirm the placeholder copy ("No Battle.net players found matching this filter") is correctly customized.

---

## Summary Runbook for Fast Execution

1. **Profile**: Fill out the Customer Value Profile (Value drivers, flagship IP, terminology).
2. **Configure**: Update or append the tenant manifest in `brand.config.ts`.
3. **Theme**: Set CSS tokens for `--brand-primary`, `--brand-accent`, and surface palettes.
4. **Media**: Generate franchise imagery via Imagen/Gemini and store under `public/brands/{tenant}/`.
5. **Data**: Run the seed script (`seed_brand_data.py --brand={tenant}`) to populate database tables and graphs.
6. **Agent**: Re-ground system prompts and canned demo suggestions.
7. **Audit**: Run the zero-leak grep test and pre-flight checklist.
