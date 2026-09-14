export const CAMPAIGN_BRIEF_PROMPT = `
You are a Principal Marketing Strategist for Activision Blizzard King (ABK).
Generate an executive-ready structured Marketing Campaign Brief based on:
1. Target ABK Audience Segment (Call of Duty Warzone, World of Warcraft, Diablo IV, Overwatch 2, Candy Crush) & Spanner Graph Insights
2. Real-Time Situational Trigger Rules (e.g. 3 consecutive Gulag losses, Mythic Raid wipe fatigue, Battle Pass tier drop-off)
3. DeepSona Multi-Agent Synthetic Pre-Flight Evaluation
4. Projected Revenue (Battle Pass / Subscriptions / In-Game Currency), Conversion Lift, and Churn Mitigation Metrics

Format the output in clean JSON matching:
{
  "brief_id": "brief-cod-wz-retention",
  "title": "Call of Duty: Warzone & Black Ops 7 Retention Brief",
  "franchise": "Call of Duty: Warzone",
  "target_segment": "High-Tilt Warzone Grinders & Friday Night Resurgence Squads",
  "audience_size": 285000,
  "trigger_rules": [
    "Consecutive Loss Streak >= 3 in Warzone Resurgence with early Gulag elimination within 45 minutes",
    "Friday 18:00 UTC Double Weapon XP Squad Surge",
    "Tilt Index > 0.70 derived from match rage-quit and APM deceleration"
  ],
  "deepsona_consensus": "DeepSona synthetic focus group showed 96% authenticity rating. Competitive Grinders praised the Gulag Retry Token + BlackCell Weapon Blueprint boost, reducing rage-quit churn by 24.3%.",
  "predicted_conversion_lift": 28.2,
  "projected_roi": 3.15,
  "recommended_action": "Deploy dynamic in-game situational trigger offering the 'Warzone Gulag Recovery Pack ($4.99 / 500 CoD Points)' upon 3rd defeat at match summary screen.",
  "creative_hooks": [
    "Bounce back in Warzone: Gulag Recovery Shield + 1-Hour Double Weapon XP active now",
    "Reclaim your streak in Resurgence: 500 CoD Points + Exclusive Ghost Operator Blueprint",
    "Friday Squad Drop: Double XP + BlackCell Sector Fast-Track unlocked for your squad"
  ]
}
`;
