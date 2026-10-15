-- Take-Two Identity Graph v2 — Spanner GoogleSQL DDL (2K Courtside v2)
--
-- Database: twok_graph_db_v2 on blackrock-spanner (jamie-bq-test).
-- Property graph: TakeTwoPlayerGraph.
--
-- Source of truth: docs/v2/CONTRACT.md §1. This schema is a strict superset of
-- schema/twok_graph_db.ddl (v1): every v1 table, column, label and property is
-- kept so Focus Group, Twin Finder and NL-to-GQL keep working unchanged. v2 adds:
--   * Players: activity / churn / concept-affinity / community columns.
--   * MemberOfClan: membership tenure + crew_centrality (0-1 weighted co-play
--     degree within the crew, normalised by the crew max at the same instant).
--   * Creators: hub_score + community_span (community bridging).
--   * New nodes: Season, Match, Stream, Brand, Activation, Item.
--   * New edges: PLAYED_WITH, FRIENDS_WITH, MESSAGED (stored ONCE per unordered
--     pair, player_id < other_player_id; query them undirected with -[e]-),
--     COMPETED_IN, IN_SEASON, SPLIT_FROM, HOSTED, WATCHED, SPONSORS, FEATURES,
--     BOUGHT, EQUIPPED.
--   * Alias labels: Clan|Crew, Identity|ViewerAccount, MEMBER_OF_CLAN|MEMBER_OF,
--     HAS_IDENTITY|LINKED_TO.
--   * CrewMembershipEvents: append-only crew history table (not in the graph).

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
  -- v2: last session timestamp (from v2_sessions_daily).
  last_active_at TIMESTAMP,
  -- v2: NULL if active. Churn = no session for 14 days; churned_at = last_active_at + 14d.
  churned_at TIMESTAMP,
  -- v2: session minutes in the last 7 days / the 7 days before that.
  session_min_7d FLOAT64,
  session_min_prev_7d FLOAT64,
  -- v2: concept affinities (0–1).
  college_hoops_affinity FLOAT64,
  wnba_affinity FLOAT64,
  franchise_mode_affinity FLOAT64,
  -- v2: label-propagation community on the co-play + watch graph (NULL = isolated).
  community_id STRING(64),
) PRIMARY KEY(player_id);

-- A franchise is modelled as a PARENT HUB row plus one row per addressable
-- surface beneath it (see v1 DDL for rationale).
CREATE TABLE Games (
  game_id STRING(64) NOT NULL,
  title STRING(128) NOT NULL,
  franchise STRING(32) NOT NULL,
  -- Take-Two publishing label: 2K | 2K_SPORTS | 2K_CORE.
  label STRING(16) NOT NULL,
  genre STRING(64),
  active_players INT64,
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
  -- v2: 0–1 community-bridging score of the creator's audience.
  hub_score FLOAT64,
  -- v2: number of player communities the creator's audience reaches (>= 3 viewers).
  community_span INT64,
) PRIMARY KEY(creator_id);

-- Crews. Table name retained for schema compatibility; UI label is "Crew".
CREATE TABLE Clans (
  clan_id STRING(64) NOT NULL,
  name STRING(128) NOT NULL,
  franchise STRING(32),
  region STRING(64),
  -- Rec | Pro-Am | Comp
  tier STRING(32),
  -- Current active members.
  member_count INT64,
) PRIMARY KEY(clan_id);

CREATE TABLE Offers (
  offer_id STRING(64) NOT NULL,
  offer_title STRING(256) NOT NULL,
  target_franchise STRING(32),
  game_id STRING(64),
  offer_type STRING(64),
  category STRING(128),
  price_usd FLOAT64,
  -- Percentage POINTS, e.g. 25.4.
  expected_conversion_boost FLOAT64,
  affinity_archetype STRING(64),
  -- CURRENT | LEGACY | UPCOMING
  lifecycle_status STRING(32),
  available_from STRING(32),
  description STRING(1024),
) PRIMARY KEY(offer_id);

-- Identity spine: 2K Account links PSN / Xbox / Steam / Switch 2 / Apple Game
-- Center, plus (v2) the Twitch / YouTube viewer accounts used for stream drops.
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

-- ---------------------------------------------------------------------------
-- v2 node tables
-- ---------------------------------------------------------------------------

CREATE TABLE Seasons (
  season_id STRING(64) NOT NULL,
  game_id STRING(64) NOT NULL,
  name STRING(128) NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
) PRIMARY KEY(season_id);

CREATE TABLE Matches (
  match_id STRING(64) NOT NULL,
  season_id STRING(64) NOT NULL,
  -- REC | PRO_AM | PARK | COMP
  mode STRING(16) NOT NULL,
  played_at TIMESTAMP NOT NULL,
) PRIMARY KEY(match_id);

CREATE TABLE Streams (
  stream_id STRING(64) NOT NULL,
  creator_id STRING(64) NOT NULL,
  title STRING(256) NOT NULL,
  platform STRING(32) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  peak_viewers INT64,
  featured_offer_id STRING(64),
  featured_item_id STRING(64),
) PRIMARY KEY(stream_id);

CREATE TABLE Brands (
  brand_id STRING(64) NOT NULL,
  name STRING(128) NOT NULL,
  category STRING(64),
  partnership_summary STRING(1024),
  logo_url STRING(512),
) PRIMARY KEY(brand_id);

CREATE TABLE BrandActivations (
  activation_id STRING(64) NOT NULL,
  brand_id STRING(64) NOT NULL,
  title STRING(256) NOT NULL,
  -- CITY_EVENT | STORE_DROP | COURT | SEASON_REWARD
  kind STRING(32) NOT NULL,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  season_id STRING(64),
) PRIMARY KEY(activation_id);

CREATE TABLE Items (
  item_id STRING(64) NOT NULL,
  name STRING(256) NOT NULL,
  -- SHOES | JERSEY | APPAREL | ACCESSORY | BUNDLE
  item_type STRING(32) NOT NULL,
  -- NULL if unbranded.
  brand_id STRING(64),
  is_branded BOOL NOT NULL,
  vc_price INT64,
) PRIMARY KEY(item_id);

-- Append-only crew history (not part of the property graph).
CREATE TABLE CrewMembershipEvents (
  event_id STRING(64) NOT NULL,
  player_id STRING(64) NOT NULL,
  clan_id STRING(64) NOT NULL,
  -- JOIN | LEAVE | KICK | SPLIT
  event_type STRING(16) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  -- SPLIT: the new crew; JOIN after a split / re-form: the crew they came from.
  related_clan_id STRING(64),
) PRIMARY KEY(event_id);

-- ---------------------------------------------------------------------------
-- Edge tables (v1)
-- ---------------------------------------------------------------------------

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
  -- v2 tenure. left_at NULL = active member.
  joined_at TIMESTAMP,
  left_at TIMESTAMP,
  is_active BOOL,
  -- v2: 0–1 weighted co-play degree within the crew (1.0 = most central
  -- member; for former members, measured at the moment they left).
  crew_centrality FLOAT64,
) PRIMARY KEY(player_id, clan_id);

CREATE TABLE HasIdentity (
  player_id STRING(64) NOT NULL,
  identity_id STRING(64) NOT NULL,
  confidence_score FLOAT64,
) PRIMARY KEY(player_id, identity_id);

-- ---------------------------------------------------------------------------
-- Edge tables (v2)
-- ---------------------------------------------------------------------------

-- Stored once per unordered pair: player_id < other_player_id.
CREATE TABLE PlayedWith (
  player_id STRING(64) NOT NULL,
  other_player_id STRING(64) NOT NULL,
  games_together_30d INT64,
  games_together_total INT64,
  last_played_at TIMESTAMP,
  -- Both players are currently active members of the same crew.
  same_crew BOOL,
) PRIMARY KEY(player_id, other_player_id);

-- Stored once per unordered pair: player_id < other_player_id.
CREATE TABLE FriendsWith (
  player_id STRING(64) NOT NULL,
  other_player_id STRING(64) NOT NULL,
  since TIMESTAMP,
) PRIMARY KEY(player_id, other_player_id);

-- Stored once per unordered pair: player_id < other_player_id.
CREATE TABLE Messaged (
  player_id STRING(64) NOT NULL,
  other_player_id STRING(64) NOT NULL,
  msg_count_30d INT64,
  last_msg_at TIMESTAMP,
) PRIMARY KEY(player_id, other_player_id);

CREATE TABLE CompetedIn (
  clan_id STRING(64) NOT NULL,
  match_id STRING(64) NOT NULL,
  -- W | L
  result STRING(1),
  score_diff INT64,
) PRIMARY KEY(clan_id, match_id);

CREATE TABLE InSeason (
  match_id STRING(64) NOT NULL,
  season_id STRING(64) NOT NULL,
) PRIMARY KEY(match_id, season_id);

CREATE TABLE SplitFrom (
  clan_id STRING(64) NOT NULL,
  parent_clan_id STRING(64) NOT NULL,
  split_at TIMESTAMP,
  shared_members INT64,
) PRIMARY KEY(clan_id, parent_clan_id);

CREATE TABLE Hosted (
  creator_id STRING(64) NOT NULL,
  stream_id STRING(64) NOT NULL,
) PRIMARY KEY(creator_id, stream_id);

CREATE TABLE Watched (
  identity_id STRING(64) NOT NULL,
  stream_id STRING(64) NOT NULL,
  watched_at TIMESTAMP,
  watch_minutes FLOAT64,
) PRIMARY KEY(identity_id, stream_id);

CREATE TABLE Sponsors (
  brand_id STRING(64) NOT NULL,
  activation_id STRING(64) NOT NULL,
) PRIMARY KEY(brand_id, activation_id);

CREATE TABLE Features (
  activation_id STRING(64) NOT NULL,
  item_id STRING(64) NOT NULL,
) PRIMARY KEY(activation_id, item_id);

CREATE TABLE Bought (
  player_id STRING(64) NOT NULL,
  item_id STRING(64) NOT NULL,
  bought_at TIMESTAMP NOT NULL,
  vc_amount INT64,
  via_activation_id STRING(64),
) PRIMARY KEY(player_id, item_id, bought_at);

CREATE TABLE Equipped (
  player_id STRING(64) NOT NULL,
  item_id STRING(64) NOT NULL,
  equipped_at TIMESTAMP,
) PRIMARY KEY(player_id, item_id);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX PlayersByFranchise ON Players(primary_franchise);
CREATE INDEX PlayersByArchetype ON Players(primary_archetype);
CREATE INDEX PlayersByChurn ON Players(churn_risk_score DESC);
CREATE INDEX PlayersBySpend ON Players(lifetime_spend_usd DESC);
CREATE INDEX PlayersByCountry ON Players(country);
CREATE INDEX PlayersByChurnedAt ON Players(churned_at);
CREATE INDEX PlayersByCommunity ON Players(community_id);
CREATE INDEX GamesByLabel ON Games(label);
CREATE INDEX IdentitiesByPlatform ON Identities(platform);
CREATE INDEX TelemetryByPlayer ON TelemetryEvents(player_id, event_timestamp DESC);

CREATE INDEX MemberOfClanByClan ON MemberOfClan(clan_id, is_active);
CREATE INDEX HasIdentityByIdentity ON HasIdentity(identity_id);
CREATE INDEX FollowsCreatorByCreator ON FollowsCreator(creator_id);
CREATE INDEX PlaysGameByGame ON PlaysGame(game_id);
CREATE INDEX PlayedWithByOther ON PlayedWith(other_player_id);
CREATE INDEX FriendsWithByOther ON FriendsWith(other_player_id);
CREATE INDEX MessagedByOther ON Messaged(other_player_id);
CREATE INDEX CompetedInByMatch ON CompetedIn(match_id);
CREATE INDEX InSeasonBySeason ON InSeason(season_id);
CREATE INDEX SplitFromByParent ON SplitFrom(parent_clan_id);
CREATE INDEX HostedByStream ON Hosted(stream_id);
CREATE INDEX WatchedByStream ON Watched(stream_id);
CREATE INDEX SponsorsByActivation ON Sponsors(activation_id);
CREATE INDEX FeaturesByItem ON Features(item_id);
CREATE INDEX BoughtByItem ON Bought(item_id, bought_at);
CREATE INDEX EquippedByItem ON Equipped(item_id);
CREATE INDEX MatchesBySeason ON Matches(season_id, played_at);
CREATE INDEX StreamsByCreator ON Streams(creator_id, started_at);
CREATE INDEX ItemsByBrand ON Items(brand_id);
CREATE INDEX ActivationsByBrand ON BrandActivations(brand_id);
CREATE INDEX CrewMembershipEventsByTime ON CrewMembershipEvents(occurred_at DESC);
CREATE INDEX CrewMembershipEventsByClan ON CrewMembershipEvents(clan_id, occurred_at DESC);
CREATE INDEX CrewMembershipEventsByPlayer ON CrewMembershipEvents(player_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Property graph
-- ---------------------------------------------------------------------------

CREATE OR REPLACE PROPERTY GRAPH TakeTwoPlayerGraph
  NODE TABLES(
    Players
      KEY(player_id)
      LABEL Player PROPERTIES(
        account_tenure_days, age, churn_risk_score, churned_at,
        college_hoops_affinity, community_id, country, country_code,
        country_flag, currency_balance, display_name, dma_market,
        followed_creators, franchise_mode_affinity, franchises_played,
        game_telemetry, gamer_tag, gender, last_active_at, lat,
        lifetime_spend_usd, lng, player_id, primary_archetype,
        primary_creator_influence, primary_email, primary_franchise,
        purchased_items, recent_loss_streak, session_min_7d,
        session_min_prev_7d, tilt_sensitivity, wnba_affinity),

    Games
      KEY(game_id)
      LABEL Game PROPERTIES(
        active_players, current_season, franchise, game_id, genre,
        is_parent_hub, label, lifecycle_status, monetization_model,
        parent_game_id, release_date, title),

    Creators
      KEY(creator_id)
      LABEL Creator PROPERTIES(
        avatar, avg_stream_viewers, community_span, conversion_affinity,
        creator_id, followers, franchise, handle, hub_score, name, platform,
        signature_mode),

    Clans
      KEY(clan_id)
      LABEL Clan PROPERTIES(
        clan_id, franchise, member_count, name, region, tier)
      LABEL Crew PROPERTIES(
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
      LABEL ViewerAccount PROPERTIES(
        confidence_score, identity_id, platform, platform_handle),

    Seasons
      KEY(season_id)
      LABEL Season PROPERTIES(
        end_at, game_id, name, season_id, start_at),

    Matches
      KEY(match_id)
      LABEL Match PROPERTIES(
        match_id, mode, played_at, season_id),

    Streams
      KEY(stream_id)
      LABEL Stream PROPERTIES(
        creator_id, ended_at, featured_item_id, featured_offer_id,
        peak_viewers, platform, started_at, stream_id, title),

    Brands
      KEY(brand_id)
      LABEL Brand PROPERTIES(
        brand_id, category, logo_url, name, partnership_summary),

    BrandActivations
      KEY(activation_id)
      LABEL Activation PROPERTIES(
        activation_id, brand_id, ends_at, kind, season_id, starts_at, title),

    Items
      KEY(item_id)
      LABEL Item PROPERTIES(
        brand_id, is_branded, item_id, item_type, name, vc_price)
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
        clan_id, crew_centrality, is_active, joined_at, left_at, player_id,
        role)
      LABEL MEMBER_OF PROPERTIES(
        clan_id, crew_centrality, is_active, joined_at, left_at, player_id,
        role),

    HasIdentity
      KEY(player_id, identity_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(identity_id) REFERENCES Identities(identity_id)
      LABEL HAS_IDENTITY PROPERTIES(
        confidence_score, identity_id, player_id)
      LABEL LINKED_TO PROPERTIES(
        confidence_score, identity_id, player_id),

    PlayedWith
      KEY(player_id, other_player_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(other_player_id) REFERENCES Players(player_id)
      LABEL PLAYED_WITH PROPERTIES(
        games_together_30d, games_together_total, last_played_at,
        other_player_id, player_id, same_crew),

    FriendsWith
      KEY(player_id, other_player_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(other_player_id) REFERENCES Players(player_id)
      LABEL FRIENDS_WITH PROPERTIES(
        other_player_id, player_id, since),

    Messaged
      KEY(player_id, other_player_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(other_player_id) REFERENCES Players(player_id)
      LABEL MESSAGED PROPERTIES(
        last_msg_at, msg_count_30d, other_player_id, player_id),

    CompetedIn
      KEY(clan_id, match_id)
      SOURCE KEY(clan_id) REFERENCES Clans(clan_id)
      DESTINATION KEY(match_id) REFERENCES Matches(match_id)
      LABEL COMPETED_IN PROPERTIES(
        clan_id, match_id, result, score_diff),

    InSeason
      KEY(match_id, season_id)
      SOURCE KEY(match_id) REFERENCES Matches(match_id)
      DESTINATION KEY(season_id) REFERENCES Seasons(season_id)
      LABEL IN_SEASON PROPERTIES(
        match_id, season_id),

    SplitFrom
      KEY(clan_id, parent_clan_id)
      SOURCE KEY(clan_id) REFERENCES Clans(clan_id)
      DESTINATION KEY(parent_clan_id) REFERENCES Clans(clan_id)
      LABEL SPLIT_FROM PROPERTIES(
        clan_id, parent_clan_id, shared_members, split_at),

    Hosted
      KEY(creator_id, stream_id)
      SOURCE KEY(creator_id) REFERENCES Creators(creator_id)
      DESTINATION KEY(stream_id) REFERENCES Streams(stream_id)
      LABEL HOSTED PROPERTIES(
        creator_id, stream_id),

    Watched
      KEY(identity_id, stream_id)
      SOURCE KEY(identity_id) REFERENCES Identities(identity_id)
      DESTINATION KEY(stream_id) REFERENCES Streams(stream_id)
      LABEL WATCHED PROPERTIES(
        identity_id, stream_id, watch_minutes, watched_at),

    Sponsors
      KEY(brand_id, activation_id)
      SOURCE KEY(brand_id) REFERENCES Brands(brand_id)
      DESTINATION KEY(activation_id) REFERENCES BrandActivations(activation_id)
      LABEL SPONSORS PROPERTIES(
        activation_id, brand_id),

    Features
      KEY(activation_id, item_id)
      SOURCE KEY(activation_id) REFERENCES BrandActivations(activation_id)
      DESTINATION KEY(item_id) REFERENCES Items(item_id)
      LABEL FEATURES PROPERTIES(
        activation_id, item_id),

    Bought
      KEY(player_id, item_id, bought_at)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(item_id) REFERENCES Items(item_id)
      LABEL BOUGHT PROPERTIES(
        bought_at, item_id, player_id, vc_amount, via_activation_id),

    Equipped
      KEY(player_id, item_id)
      SOURCE KEY(player_id) REFERENCES Players(player_id)
      DESTINATION KEY(item_id) REFERENCES Items(item_id)
      LABEL EQUIPPED PROPERTIES(
        equipped_at, item_id, player_id)
  );
