-- Take-Two Identity Graph — Spanner GoogleSQL DDL (2K Courtside)
--
-- Database: twok_graph_db on blackrock-spanner (jamie-bq-test).
-- Property graph: TakeTwoPlayerGraph.
--
-- The table layout mirrors the previous demo schema so the application's
-- player projection keeps working unchanged. 2K-specific changes:
--   * Games.label  — Take-Two publishing label: 2K | ROCKSTAR | ZYNGA.
--   * Players.game_telemetry carries the NBA 2K27 MyPLAYER / MyTEAM / Park /
--     cross-label fields (see src/lib/types NBA2KTelemetry).
--   * Clans / MemberOfClan are kept as table names; the product calls them
--     Crews (tier ∈ Rec | Pro-Am | Comp).
--
-- Node labels are SINGULAR (Player, Game, Creator, Clan, Offer, Identity) so
-- that the GQL emitted by the NL translator reads naturally: MATCH (p:Player).

CREATE TABLE Players (
  player_id STRING(64) NOT NULL,
  display_name STRING(128) NOT NULL,
  gamer_tag STRING(128) NOT NULL,
  -- Stored pre-masked (j***@domain). No other PII beyond the gamer tag.
  primary_email STRING(256),
  primary_franchise STRING(32) NOT NULL,
  franchises_played ARRAY<STRING(32)>,
  primary_archetype STRING(64) NOT NULL,
  lifetime_spend_usd FLOAT64 NOT NULL,
  churn_risk_score FLOAT64 NOT NULL,
  -- Surfaced in the UI as "Rage-Quit Index" (0–1).
  tilt_sensitivity FLOAT64 NOT NULL,
  -- Surfaced in the UI as "Park loss streak".
  recent_loss_streak INT64 NOT NULL,
  age INT64,
  gender STRING(32),
  account_tenure_days INT64,
  -- VC balance for 2K players; label-native soft currency otherwise.
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

-- A franchise is modelled as a PARENT HUB row plus one row per addressable
-- surface beneath it. NBA 2K27 is the hub for MyCAREER / The City, MyTEAM and
-- MyNBA & The W, because a MyTEAM pack whale and a Park Rep grinder are
-- different, separately-addressable audiences that would be invisible if the
-- title were a single row. GTA VI is PRE_LAUNCH: a PLAYS_GAME edge to it means
-- the player has PRE-ORDERED.
CREATE TABLE Games (
  game_id STRING(64) NOT NULL,
  title STRING(128) NOT NULL,
  franchise STRING(32) NOT NULL,
  -- Take-Two publishing label: 2K | ROCKSTAR | ZYNGA.
  label STRING(16) NOT NULL,
  genre STRING(64),
  active_players INT64,
  -- TRUE for the franchise roots. The application filters on this to place
  -- the macro-view hub nodes.
  is_parent_hub BOOL,
  parent_game_id STRING(64),
  release_date STRING(32),
  -- LIVE | LEGACY | PRE_LAUNCH | SUNSET
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

-- Crews. Table name retained for schema compatibility; UI label is "Crew".
CREATE TABLE Clans (
  clan_id STRING(64) NOT NULL,
  name STRING(128) NOT NULL,
  franchise STRING(32),
  region STRING(64),
  -- Rec | Pro-Am | Comp (Rockstar crews and WWE factions reuse the scale)
  tier STRING(32),
  member_count INT64,
) PRIMARY KEY(clan_id);

CREATE TABLE Offers (
  offer_id STRING(64) NOT NULL,
  offer_title STRING(256) NOT NULL,
  target_franchise STRING(32),
  -- Which surface this SKU belongs to, e.g. a MyTEAM pack is attributed to
  -- game-nba2k27-myteam rather than to the franchise hub.
  game_id STRING(64),
  offer_type STRING(64),
  category STRING(128),
  price_usd FLOAT64,
  -- Percentage POINTS, e.g. 25.4.
  expected_conversion_boost FLOAT64,
  -- One of the ten canonical archetypes in src/lib/archetypes.ts.
  affinity_archetype STRING(64),
  -- CURRENT | LEGACY | UPCOMING
  lifecycle_status STRING(32),
  available_from STRING(32),
  description STRING(1024),
) PRIMARY KEY(offer_id);

-- Identity spine: 2K Account links PlayStation Network / Xbox Live / Steam /
-- Nintendo Switch 2; Rockstar Social Club and Zynga ID are the sibling-label
-- spines. HAS_IDENTITY edges across spines are the cross-label bridges.
CREATE TABLE Identities (
  identity_id STRING(64) NOT NULL,
  platform STRING(64) NOT NULL,
  platform_handle STRING(128),
  confidence_score FLOAT64,
) PRIMARY KEY(identity_id);

-- NBA 2K27 live-service events. event_type ∈ PARK_GAME_COMPLETE |
-- REC_GAME_COMPLETE | MYTEAM_PACK_OPENED | SEASON_PASS_LEVEL_UP | RAGE_QUIT |
-- VC_PURCHASE | CREW_INVITE_SENT | DAILY_LOGIN.
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
  -- CAPTAIN | CO_CAPTAIN | MEMBER
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
CREATE INDEX GamesByLabel ON Games(label);
CREATE INDEX IdentitiesByPlatform ON Identities(platform);
CREATE INDEX TelemetryByPlayer ON TelemetryEvents(player_id, event_timestamp DESC);

CREATE OR REPLACE PROPERTY GRAPH TakeTwoPlayerGraph
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
        is_parent_hub, label, lifecycle_status, monetization_model,
        parent_game_id, release_date, title),

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
