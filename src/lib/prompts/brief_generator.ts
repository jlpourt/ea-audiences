export const CAMPAIGN_BRIEF_PROMPT = `
You are a Principal Marketing Strategist for Activision Publishing and the Call of Duty Live Service Ecosystem.
Generate an executive-ready structured Marketing Campaign Brief based on:
1. Target Call of Duty Audience Segment (Warzone & Resurgence, Black Ops 6 & Zombies, Modern Warfare III, CDL Ranked, CoD Mobile) & Spanner Graph Insights
2. Real-Time Situational Trigger Rules (e.g. 3 consecutive Gulag losses, Mythic Raid wipe fatigue, Battle Pass tier drop-off)
3. Grounded Reddit & Social Sentiment Analysis (strictly preventing Pay-to-Win backlash)
4. DeepSona Multi-Agent Synthetic Pre-Flight Evaluation
5. Projected Revenue (Battle Pass / Subscriptions / In-Game Currency), Conversion Lift, and Churn Mitigation Metrics

Format the output in clean JSON matching:
{
  "brief_id": "brief-cod-wz-retention",
  "title": "Call of Duty: Warzone & Black Ops 7 Momentum Brief",
  "franchise": "Call of Duty: Warzone",
  "target_segment": "High-Tilt Warzone Grinders & Friday Night Resurgence Squads",
  "audience_size": 285000,
  "trigger_rules": [
    "Consecutive Loss Streak >= 3 in Warzone Resurgence with early Gulag elimination within 45 minutes",
    "Friday 18:00 UTC Double Weapon XP Squad Surge",
    "Tilt Index > 0.70 derived from match defeat and APM deceleration"
  ],
  "deepsona_consensus": "DeepSona synthetic focus group verified +32.4% conversion lift with zero anti-P2W backlash. Competitive Grinders favored 1-Hour 2x Weapon XP and Operator Tactical Blueprint over any match-modifying mechanics.",
  "predicted_conversion_lift": 32.4,
  "projected_roi": 3.25,
  "recommended_action": "Deploy dynamic in-game situational trigger offering the 'Warzone Resurgence Momentum Drop ($4.99 / 500 CoD Points)' upon 3rd defeat at match summary screen.",
  "creative_hooks": [
    "Reset your momentum: 1-Hour Double Weapon XP + 500 CoD Points unlocked",
    "Reclaim your streak in Resurgence: Exclusive Tactical Operator Blueprint active now",
    "Friday Squad Drop: Double XP + BlackCell Sector Fast-Track unlocked for your squad"
  ],
  "grounded_community_insight": "Live Google Search grounding over r/CODWarzone and r/CallOfDuty flagged high boycott sensitivity against paid match-retry mechanics ('pay-to-win'). Pivoting to progression acceleration and cosmetic camos maintained high purchase intent while protecting brand equity.",
  "strategic_pivot": {
    "original_concept": "Gulag Recovery Shield / Match Retry Token ($4.99)",
    "pivot_reason": "Grounded Reddit sentiment warned of severe anti-P2W backlash and competitive integrity violations.",
    "pivoted_concept": "Resurgence Momentum Drop: 500 CP + 1-Hour 2x Weapon XP + Tactical Operator Weapon Camo"
  }
}
`;
