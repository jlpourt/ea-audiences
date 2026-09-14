#!/usr/bin/env python3
"""
Repair `triggered_offer_id` on telemetry events.

WHY THIS IS NEEDED
------------------
The trigger feed's whole premise is: a player hits a frustration moment, and we
respond with a small, well-judged recovery offer. The offer id was baked into
each telemetry row positionally, so when the catalog was renumbered the ids
still *resolved* -- they just pointed at completely different SKUs:

    GULAG_DEFEAT_LOSS_STREAK -> off-cod-08       was a $4.99 recovery starter,
                                                 became a $99.99 CoD Points vault
    RAID_WIPE_STREAK         -> off-wow-08       became a $49.99 expansion
    PIT_DEATH_SLUMP          -> off-diablo4-08   became a $39.99 legacy expansion
    OUT_OF_MOVES_STUCK       -> off-overwatch2-01 (156 events) -- a Candy Crush
                                                 event pointing at an Overwatch
                                                 battle pass

Offering a $99.99 currency vault to someone who just lost three Gulags in a row
is the opposite of the pitch. This script re-resolves each event to the
cheapest CURRENT offer in the event's own franchise, which is what a recovery
SKU actually is, and refuses to write anything if a franchise has no such offer.

Run:  python3 scripts/repair_telemetry_offers.py [--dry-run]
"""
import json
import sys
from collections import Counter

TELEMETRY = "data/telemetry_match_events.json"
OFFERS = "data/marketing_offers.json"

# The recovery SKU is chosen by INTENT, not by price.
#
# Picking "the cheapest current offer" was tried first and produced nonsense:
# a $5 charity pet as the answer to a raid wipe, and a $1.99 / 200 CoD Points
# pack that is too small to actually buy anything. Each rule below names the
# kind of purchase a frustrated player in that specific game plausibly makes,
# and is expressed as a selector rather than a hardcoded offer id -- a
# hardcoded id is exactly what broke when the catalog was renumbered.
#
# `min_price` exists to skip token denominations that cannot buy anything.
EVENT_RULES = {
    "GULAG_DEFEAT_LOSS_STREAK": {
        "franchise": "COD",
        "offer_types": ["VIRTUAL_CURRENCY"],
        "min_price": 4.0,
        "rationale": "Small CP top-up to unlock an operator skin or battle pass tier.",
    },
    "RAID_WIPE_STREAK": {
        "franchise": "WOW",
        "offer_types": ["VIRTUAL_CURRENCY"],
        "min_price": 0.0,
        "rationale": "WoW Token: the real in-game response to progression frustration "
                     "is to convert cash into gold and buy a carry.",
    },
    "PIT_DEATH_SLUMP": {
        "franchise": "DIABLO4",
        "offer_types": ["BATTLE_PASS"],
        "min_price": 0.0,
        "rationale": "A cheap seasonal pass re-frames a stalled run as progress.",
    },
    "OUT_OF_MOVES_STUCK": {
        "franchise": "CANDYCRUSH",
        "offer_types": ["BOOSTER"],
        "min_price": 0.0,
        "rationale": "The literal rescue SKU for this exact moment: extra moves on fail.",
    },
}

# A recovery offer that costs more than this is not a recovery offer.
MAX_RECOVERY_PRICE = 25.0


def main():
    dry = "--dry-run" in sys.argv

    events = json.load(open(TELEMETRY))
    offers = json.load(open(OFFERS))

    recovery = {}
    for event_type, rule in EVENT_RULES.items():
        candidates = [
            o
            for o in offers
            if o.get("target_franchise") == rule["franchise"]
            # Legacy SKUs are excluded: pitching a retired expansion as a
            # consolation prize is worse than pitching nothing.
            and o.get("lifecycle_status") != "LEGACY"
            and o.get("offer_type") in rule["offer_types"]
            and rule["min_price"] <= o["price_usd"] <= MAX_RECOVERY_PRICE
        ]
        if not candidates:
            raise SystemExit(
                f"No recovery SKU for {event_type}: no {rule['offer_types']} offer "
                f"in {rule['franchise']} priced "
                f"${rule['min_price']}-${MAX_RECOVERY_PRICE}."
            )
        recovery[event_type] = min(candidates, key=lambda o: o["price_usd"])

    print("Recovery offer per event type:")
    for et, o in sorted(recovery.items()):
        print(f"  {et:<28} {o['offer_id']:<20} ${o['price_usd']:<7} {o['offer_title']}")
        print(f"  {'':<28} {EVENT_RULES[et]['rationale']}")

    changed = 0
    unknown = Counter()
    for e in events:
        rule = recovery.get(e.get("event_type"))
        if not rule:
            unknown[e.get("event_type")] += 1
            continue
        if e.get("triggered_offer_id") != rule["offer_id"]:
            e["triggered_offer_id"] = rule["offer_id"]
            changed += 1

    if unknown:
        raise SystemExit(
            "Telemetry contains event types with no recovery rule: "
            + ", ".join(f"{k} ({v})" for k, v in unknown.items())
        )

    print(f"\n{changed} of {len(events)} events repointed.")
    after = Counter(
        (e["event_type"], e["triggered_offer_id"]) for e in events
    )
    print("\nEvent type -> offer after repair:")
    for (et, oid), n in sorted(after.items()):
        o = next(x for x in offers if x["offer_id"] == oid)
        print(f"  {et:<28} -> {oid:<20} ${o['price_usd']:<7} {o['target_franchise']:<12} ({n} events)")

    if dry:
        print("\n--dry-run: nothing written.")
        return

    with open(TELEMETRY, "w") as fh:
        json.dump(events, fh, indent=2)
    print(f"\nWrote {TELEMETRY}")


if __name__ == "__main__":
    main()
