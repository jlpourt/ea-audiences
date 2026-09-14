#!/usr/bin/env python3
"""
Seeds Spanner Graph and BigQuery with generated EA synthetic dataset.
"""

import os
import json
import logging
from google.cloud import spanner
from google.cloud import bigquery

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_spanner_bigquery")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "jamie-bq-test")
INSTANCE_ID = os.getenv("SPANNER_INSTANCE_ID", "bravoverse-spanner")
DATABASE_ID = os.getenv("SPANNER_DATABASE_ID", "abk_graph_db")
BQ_DATASET = os.getenv("BQ_DATASET_ID", "abk_marketing_intelligence")

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")

def seed_spanner():
    logger.info(f"Connecting to Spanner: {PROJECT_ID}/{INSTANCE_ID}/{DATABASE_ID}...")
    try:
        client = spanner.Client(project=PROJECT_ID)
        instance = client.instance(INSTANCE_ID)
        database = instance.database(DATABASE_ID)

        # 1. Insert Games
        with open(os.path.join(DATA_DIR, "games.json")) as f:
            games = json.load(f)
        
        with database.batch() as batch:
            batch.insert_or_update(
                table="Game",
                columns=("game_id", "title", "genre", "platform_support"),
                values=[(g["game_id"], g["title"], g["genre"], g["platforms"]) for g in games]
            )
        logger.info(f"✅ Seeded {len(games)} games to Spanner.")

        # 2. Insert Offers
        with open(os.path.join(DATA_DIR, "marketing_offers.json")) as f:
            offers = json.load(f)
        
        with database.batch() as batch:
            batch.insert_or_update(
                table="MarketingOffer",
                columns=("offer_id", "offer_title", "target_franchise", "offer_type", "price_usd", "discount_percent", "trigger_condition", "description"),
                values=[(o["offer_id"], o["offer_title"], o["target_franchise"], o["offer_type"], o["price_usd"], o["discount_percent"], o["trigger_condition"], o["description"]) for o in offers]
            )
        logger.info(f"✅ Seeded {len(offers)} marketing offers to Spanner.")

        # 3. Insert Clans (batch chunks)
        with open(os.path.join(DATA_DIR, "clans.json")) as f:
            clans = json.load(f)
        
        with database.batch() as batch:
            batch.insert_or_update(
                table="Clan",
                columns=("clan_id", "clan_name", "game_id", "member_count", "activity_level"),
                values=[(c["clan_id"], c["clan_name"], c["game_id"], c["member_count"], c["activity_level"]) for c in clans]
            )
        logger.info(f"✅ Seeded {len(clans)} clans to Spanner.")

        # 4. Insert Master Players (in chunks of 500)
        with open(os.path.join(DATA_DIR, "master_players.json")) as f:
            players = json.load(f)

        chunk_size = 300
        for i in range(0, len(players), chunk_size):
            chunk = players[i:i+chunk_size]
            with database.batch() as batch:
                batch.insert_or_update(
                    table="MasterPlayer",
                    columns=("player_id", "display_name", "primary_email", "country", "lifetime_spend_usd", "primary_archetype", "churn_risk_score", "tilt_sensitivity", "archetype_embedding"),
                    values=[(p["player_id"], p["display_name"], p["primary_email"], p["country"], p["lifetime_spend_usd"], p["primary_archetype"], p["churn_risk_score"], p["tilt_sensitivity"], p["archetype_embedding"]) for p in chunk]
                )
            logger.info(f"✅ Seeded {min(i+chunk_size, len(players))}/{len(players)} players to Spanner.")

        # 5. Insert Platform Identities
        with open(os.path.join(DATA_DIR, "platform_identities.json")) as f:
            identities = json.load(f)

        for i in range(0, len(identities), chunk_size):
            chunk = identities[i:i+chunk_size]
            with database.batch() as batch:
                batch.insert_or_update(
                    table="PlatformIdentity",
                    columns=("identity_id", "platform", "platform_handle", "confidence_score"),
                    values=[(ident["identity_id"], ident["platform"], ident["platform_handle"], ident["confidence_score"]) for ident in chunk]
                )

        logger.info(f"✅ Seeded {len(identities)} platform identities to Spanner.")

        # 6. Insert Edges: HasIdentity, PlayedGame, MemberOfClan
        with open(os.path.join(DATA_DIR, "has_identity_edges.json")) as f:
            has_id = json.load(f)
        for i in range(0, len(has_id), chunk_size):
            chunk = has_id[i:i+chunk_size]
            with database.batch() as batch:
                batch.insert_or_update(
                    table="HasIdentity",
                    columns=("player_id", "identity_id", "verification_source"),
                    values=[(e["player_id"], e["identity_id"], e["verification_source"]) for e in chunk]
                )

        with open(os.path.join(DATA_DIR, "played_game_edges.json")) as f:
            played = json.load(f)
        for i in range(0, len(played), chunk_size):
            chunk = played[i:i+chunk_size]
            with database.batch() as batch:
                batch.insert_or_update(
                    table="PlayedGame",
                    columns=("player_id", "game_id", "hours_played", "total_spend_usd", "skill_rating"),
                    values=[(e["player_id"], e["game_id"], e["hours_played"], e["total_spend_usd"], e["skill_rating"]) for e in chunk]
                )

        with open(os.path.join(DATA_DIR, "member_of_clan_edges.json")) as f:
            clan_edges = json.load(f)
        for i in range(0, len(clan_edges), chunk_size):
            chunk = clan_edges[i:i+chunk_size]
            with database.batch() as batch:
                batch.insert_or_update(
                    table="MemberOfClan",
                    columns=("player_id", "clan_id", "role"),
                    values=[(e["player_id"], e["clan_id"], e["role"]) for e in chunk]
                )

        logger.info("🎉 Spanner Graph database seeding complete!")
    except Exception as e:
        logger.warning(f"Spanner seeding notice (ensure Spanner instance exists and DDL is applied): {e}")

def seed_bigquery():
    logger.info(f"Connecting to BigQuery dataset: {PROJECT_ID}.{BQ_DATASET}...")
    try:
        client = bigquery.Client(project=PROJECT_ID)

        # Load fct_player_identity_graph
        with open(os.path.join(DATA_DIR, "fct_player_identity_graph.json")) as f:
            id_graph = json.load(f)

        table_id = f"{PROJECT_ID}.{BQ_DATASET}.fct_player_identity_graph"
        errors = client.insert_rows_json(table_id, id_graph[:1000])
        if errors:
            logger.error(f"BQ Insert errors for identity graph: {errors}")
        else:
            logger.info(f"✅ Seeded records into BigQuery {table_id}")

        # Load telemetry
        with open(os.path.join(DATA_DIR, "telemetry_match_events.json")) as f:
            telemetry = json.load(f)

        # Format metadata_json as string for BQ JSON type
        formatted_telemetry = []
        for t in telemetry[:2000]:
            item = dict(t)
            if isinstance(item.get("metadata_json"), dict):
                item["metadata_json"] = json.dumps(item["metadata_json"])
            formatted_telemetry.append(item)

        table_id = f"{PROJECT_ID}.{BQ_DATASET}.fct_player_telemetry_events"
        errors = client.insert_rows_json(table_id, formatted_telemetry)
        if errors:
            logger.error(f"BQ Insert errors for telemetry: {errors[:2]}")
        else:
            logger.info(f"✅ Seeded {len(formatted_telemetry)} telemetry records into BigQuery {table_id}")
    except Exception as e:
        logger.warning(f"BigQuery seeding notice: {e}")

if __name__ == "__main__":
    seed_spanner()
    seed_bigquery()
