-- ABK Player Graph — Spanner GoogleSQL DDL
--
-- This is the live schema backing the demo. It replaces the local JSON
-- fallback engine, which was only ever reachable because the configured
-- database (abk_graph_db) did not exist.
--
-- Node labels are SINGULAR (Player, Game, Creator, Clan, Offer, Identity) so
-- that the GQL emitted by the NL translator reads naturally: MATCH (p:Player).

CREATE TABLE Players (
  player_id STRING(64) NOT NULL,
  display_name STRING(128) NOT NULL,
  gamer_tag STRING(128) NOT NULL,
  primary_email STRING(256),
  primary_franchise STRING(32) NOT NULL,
  franchises_played ARRAY<STRING(32)>,
  primary_archetype STRING(64) NOT NULL,
  lifetime_spend_usd FLOAT64 NOT NULL,
  churn_risk_score FLOAT64 NOT NULL,
  tilt_sensitivity FLOAT64 NOT NULL,
  recent_loss_streak INT64 NOT NULL,
  age INT64,
  gender STRING(32),
  account_tenure_days INT64,
  currency_balance INT64,
  country STRING(64),
  country_code STRING(8),
  country_flag STRING(16),
  dma_market STRING(128),
  lat FLOAT64,
  lng FLOAT64,
  followed_creators ARRAY<STRING(64)>,
  primary_creator_influence STRING(64),
  game_telemetry JSON,
  purchased_items JSON,
) PRIMARY KEY(player_id);

-- A franchise is modelled as a PARENT HUB row plus one row per purchasable
-- surface beneath it (current release, legacy expansion, classic realm,
-- upcoming pre-order). This matters for WoW in particular: a player who never
-- bought Dragonflight is a different, separately-addressable upsell from one
-- who is simply unsubscribed, and that distinction is invisible if the
-- franchise is a single row.
CREATE TABLE Games (
  game_id STRING(64) NOT NULL,
  title STRING(128) NOT NULL,
  franchise STRING(32) NOT NULL,
  genre STRING(64),
  active_players INT64,
  -- TRUE for the five franchise roots. The application filters on this to
  -- place the macro-view hub nodes; it previously read the field off local
  -- JSON that never defined it, so the filter always returned empty.
  is_parent_hub BOOL,
  parent_game_id STRING(64),
  release_date STRING(32),
  -- LIVE | LEGACY | UPCOMING | SUNSET
  lifecycle_status STRING(32),
  monetization_model STRING(64),
  current_season STRING(128),
) PRIMARY KEY(game_id);

CREATE TABLE Creators (
  creator_id STRING(64) NOT NULL,
  handle STRING(128) NOT NULL,
  name STRING(128) NOT NULL,
  platform STRING(64) NOT NULL,
  franchise STRING(32),
  followers INT64,
  avg_stream_viewers INT64,
  conversion_affinity FLOAT64,
  signature_mode STRING(128),
  avatar STRING(256),
) PRIMARY KEY(creator_id);

CREATE TABLE Clans (
  clan_id STRING(64) NOT NULL,
  name STRING(128) NOT NULL,
  franchise STRING(32),
  region STRING(64),
  tier STRING(32),
  member_count INT64,
) PRIMARY KEY(clan_id);

CREATE TABLE Offers (
  offer_id STRING(64) NOT NULL,
  offer_title STRING(256) NOT NULL,
  target_franchise STRING(32),
  -- Which surface this SKU belongs to. Lets a legacy-expansion offer be
  -- attributed to the expansion rather than to the franchise as a whole.
  game_id STRING(64),
  offer_type STRING(64),
  category STRING(128),
  price_usd FLOAT64,
  -- Percentage POINTS, e.g. 25.4. Previously the JSON held the string
  -- "+25.4%", which the loader passed through Number() and stored as NULL.
  expected_conversion_boost FLOAT64,
  -- One of the ten canonical archetypes in src/lib/archetypes.ts. The graph
  -- route already matched on this field; it did not exist in the data, so
  -- archetype-aware offer targeting silently degraded to franchise matching.
  affinity_archetype STRING(64),
  -- CURRENT | LEGACY
  lifecycle_status STRING(32),
  available_from STRING(32),
  description STRING(1024),
) PRIMARY KEY(offer_id);

CREATE TABLE Identities (
  identity_id STRING(64) NOT NULL,
  platform STRING(64) NOT NULL,
  platform_handle STRING(128),
  confidence_score FLOAT64,
) PRIMARY KEY(identity_id);

CREATE TABLE TelemetryEvents (
  event_id STRING(64) NOT NULL,
  player_id STRING(64) NOT NULL,
  game_id STRING(64),
  event_type STRING(64) NOT NULL,
  consecutive_losses INT64,
  tilt_index FLOAT64,
  event_timestamp STRING(64),
  triggered_offer_id STRING(64),
) PRIMARY KEY(event_id);

CREATE TABLE PlaysGame (
  player_id STRING(64) NOT NULL,
  game_id STRING(64) NOT NULL,
  hours_played FLOAT64,
  last_played_timestamp STRING(64),
) PRIMARY KEY(player_id, game_id);

CREATE TABLE FollowsCreator (
  player_id STRING(64) NOT NULL,
  creator_id STRING(64) NOT NULL,
  affinity_level STRING(32),
) PRIMARY KEY(player_id, creator_id);

CREATE TABLE MemberOfClan (
  player_id STRING(64) NOT NULL,
  clan_id STRING(64) NOT NULL,
  role STRING(64),
) PRIMARY KEY(player_id, clan_id);

CREATE TABLE HasIdentity (
  player_id STRING(64) NOT NULL,
  identity_id STRING(64) NOT NULL,
  confidence_score FLOAT64,
) PRIMARY KEY(player_id, identity_id);

CREATE INDEX PlayersByFranchise ON Players(primary_franchise);
CREATE INDEX PlayersByArchetype ON Players(primary_archetype);
CREATE INDEX PlayersByChurn ON Players(churn_risk_score DESC);
CREATE INDEX PlayersBySpend ON Players(lifetime_spend_usd DESC);
CREATE INDEX PlayersByCountry ON Players(country);

CREATE OR REPLACE PROPERTY GRAPH ABKPlayerGraph
  NODE TABLES(
    Players
      KEY(player_id)
      LABEL Player PROPERTIES(
        account_tenure_days, age, churn_risk_score, country, country_code,
        country_flag, currency_balance, display_name, dma_market,
        followed_creators, franchises_played, game_telemetry, gamer_tag,
        gender, lat, lifetime_spend_usd, lng, player_id, primary_archetype,
        primary_creator_influence, primary_email, primary_franchise,
        purchased_items, recent_loss_streak, tilt_sensitivity),

    Games
      KEY(game_id)
      LABEL Game PROPERTIES(
        active_players, current_season, franchise, game_id, genre,
        is_parent_hub, lifecycle_status, monetization_model, parent_game_id,
        release_date, title),

    Creators
      KEY(creator_id)
      LABEL Creator PROPERTIES(
        avatar, avg_stream_viewers, conversion_affinity, creator_id,
        followers, franchise, handle, name, platform, signature_mode),

    Clans
      KEY(clan_id)
      LABEL Clan PROPERTIES(
        clan_id, franchise, member_count, name, region, tier),

    Offers
      KEY(offer_id)
      LABEL Offer PROPERTIES(
        affinity_archetype, available_from, category, description,
        expected_conversion_boost, game_id, lifecycle_status, offer_id,
        offer_title, offer_type, price_usd, target_franchise),

    Identities
      KEY(identity_id)
      LABEL Identity PROPERTIES(
        confidence_score, identity_id, platform, platform_handle)
  )
  EDGE TABLES(
    PlaysGame
      KEY(player_id, game_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(game_id) REFERENCES Games(game_id)
      LABEL PLAYS_GAME PROPERTIES(
        game_id, hours_played, last_played_timestamp, player_id),

    FollowsCreator
      KEY(player_id, creator_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(creator_id) REFERENCES Creators(creator_id)
      LABEL FOLLOWS_CREATOR PROPERTIES(
        affinity_level, creator_id, player_id),

    MemberOfClan
      KEY(player_id, clan_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(clan_id) REFERENCES Clans(clan_id)
      LABEL MEMBER_OF_CLAN PROPERTIES(
        clan_id, player_id, role),

    HasIdentity
      KEY(player_id, identity_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(identity_id) REFERENCES Identities(identity_id)
      LABEL HAS_IDENTITY PROPERTIES(
        confidence_score, identity_id, player_id)
  );
