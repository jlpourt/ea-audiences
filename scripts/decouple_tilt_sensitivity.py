#!/usr/bin/env python3
"""
Decouple `tilt_sensitivity` from `recent_loss_streak`.

Problem found in the live data: tilt was a deterministic function of loss
streak. Every player with a streak of 3+ had tilt in [0.75, 0.95], and no
player with a streak of 3+ had tilt below 0.6. That makes the demo's
two-factor story ("high tilt AND a loss streak") secretly a one-factor
story — the tilt predicate never excludes anyone, so a marketer testing
whether tilt adds signal would find it changes nothing.

It is also behaviourally wrong. Tilt sensitivity is a disposition: how a
player *reacts* to losing. Losing streaks and tilt should be correlated
(players prone to tilt chase losses and extend streaks) but not identical.
Plenty of players lose repeatedly and shrug.

Fix: redraw tilt from a beta distribution whose mean rises with loss streak,
so the correlation survives but the coupling does not. Concretely, after this
runs a 3+ streak cohort still skews high-tilt, but contains genuinely
low-tilt players, and high-tilt players exist at every streak level.

Only `tilt_sensitivity` is modified. Every other field is left byte-identical.
"""

import json
import random
import statistics
from collections import Counter

PATH = "data/master_players.json"
SEED = 20260914

# Beta(a, b) parameters per loss-streak level. Mean = a / (a + b).
# Chosen so the mean climbs with streak while the spread stays wide enough
# that both tails remain populated at every level.
BETA_BY_STREAK = {
    0: (2.0, 4.5),   # mean ~0.31
    1: (2.4, 4.0),   # mean ~0.38
    2: (3.0, 3.6),   # mean ~0.45
    3: (3.8, 3.2),   # mean ~0.54
    4: (4.6, 2.8),   # mean ~0.62
    5: (5.4, 2.4),   # mean ~0.69
}
FALLBACK = (5.4, 2.4)


def main() -> None:
    rng = random.Random(SEED)

    with open(PATH) as f:
        players = json.load(f)

    before_by_streak: dict[int, list[float]] = {}
    after_by_streak: dict[int, list[float]] = {}

    for p in players:
        streak = int(p.get("recent_loss_streak", 0) or 0)
        a, b = BETA_BY_STREAK.get(streak, FALLBACK)

        old = float(p.get("tilt_sensitivity", 0) or 0)
        # Clamp to the original field's observed range so downstream
        # thresholds (0.6) keep the same meaning.
        new = round(min(0.95, max(0.05, rng.betavariate(a, b))), 2)

        p["tilt_sensitivity"] = new

        before_by_streak.setdefault(streak, []).append(old)
        after_by_streak.setdefault(streak, []).append(new)

    with open(PATH, "w") as f:
        json.dump(players, f, indent=2)

    print(f"Rewrote tilt_sensitivity for {len(players)} players.\n")
    print(f"{'streak':>6} {'n':>6} {'old mean':>9} {'new mean':>9} "
          f"{'new min':>8} {'new max':>8} {'% tilt>=0.6':>12}")
    for streak in sorted(after_by_streak):
        old_vals = before_by_streak[streak]
        new_vals = after_by_streak[streak]
        share_high = 100 * sum(1 for v in new_vals if v >= 0.6) / len(new_vals)
        print(f"{streak:>6} {len(new_vals):>6} "
              f"{statistics.mean(old_vals):>9.3f} {statistics.mean(new_vals):>9.3f} "
              f"{min(new_vals):>8.2f} {max(new_vals):>8.2f} {share_high:>11.1f}%")

    # The point of the exercise: tilt must now split the high-streak cohort.
    high_streak = [p for p in players if int(p.get("recent_loss_streak", 0) or 0) >= 3]
    low_tilt_high_streak = [p for p in high_streak if p["tilt_sensitivity"] < 0.6]
    high_tilt_low_streak = [
        p for p in players
        if int(p.get("recent_loss_streak", 0) or 0) == 0 and p["tilt_sensitivity"] >= 0.6
    ]
    print(f"\nStreak>=3 players: {len(high_streak)}")
    print(f"  ...of which LOW tilt (<0.6): {len(low_tilt_high_streak)} "
          f"({100 * len(low_tilt_high_streak) / max(len(high_streak), 1):.1f}%)  "
          f"<- these were previously impossible")
    print(f"Streak==0 but HIGH tilt (>=0.6): {len(high_tilt_low_streak)}")


if __name__ == "__main__":
    main()
