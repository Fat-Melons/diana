use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Deserialize, Debug)]
pub struct PlayerQuery {
    pub name: String,
    pub tag: String,
    pub region: String,
}

#[derive(Deserialize, Debug)]
pub struct MatchQuery {
    pub match_id: String,
    pub user_puuid: String,
}

#[derive(Deserialize, Debug)]
pub struct ActivityQuery {
    pub user_puuid: String,
}


#[derive(Serialize, Debug)]
pub struct PlayerProfile {
    pub puuid: String,
    pub name: String,
    pub tagline: String,
    pub region: String,
    pub summoner_level: u32,
    pub profile_icon_url: String,
    pub tier: Option<String>,
    pub division: Option<String>,
    pub lp: Option<i32>,
}

#[derive(Deserialize, Debug)]
pub struct AccountDto {
    pub puuid: String,
    pub gameName: String,
    pub tagLine: String,
}

#[derive(Deserialize, Debug)]
pub struct SummonerDto {
    #[serde(default)]
    pub id: String,
    pub puuid: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub profileIconId: i32,
    #[serde(default)]
    pub summonerLevel: i64,
}

#[derive(Deserialize, Debug)]
pub struct LeagueEntryDto {
    pub queueType: String,
    pub tier: String,
    pub rank: String,
    pub leaguePoints: i32,
}

#[derive(Deserialize, Debug)]
pub struct MatchDto {
    pub info: MatchInfo,
}

#[derive(Deserialize, Debug)]
pub struct MatchInfo {
    pub gameCreation: i64,
    pub gameDuration: i64,
    pub queueId: i32,
    pub participants: Vec<ParticipantDto>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ParticipantDto {
    pub puuid: String,
    pub championName: String,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub win: bool,

    #[serde(default)]
    pub totalMinionsKilled: Option<i32>,
    #[serde(default)]
    pub neutralMinionsKilled: Option<i32>,

    #[serde(default)]
    pub goldEarned: i32,
    #[serde(default)]
    pub item0: i32,
    #[serde(default)]
    pub item1: i32,
    #[serde(default)]
    pub item2: i32,
    #[serde(default)]
    pub item3: i32,
    #[serde(default)]
    pub item4: i32,
    #[serde(default)]
    pub item5: i32,
    #[serde(default)]
    pub item6: i32,
    #[serde(default)]
    pub totalDamageDealtToChampions: i32,
    #[serde(default)]
    pub totalDamageTaken: i32,
    #[serde(default)]
    pub visionScore: i32,
    #[serde(default)]
    pub teamPosition: String,
    #[serde(default)]
    pub teamId: i32,
    #[serde(default)]
    pub challenges: Option<ChallengesDto>,
    #[serde(default)]
    pub turretTakedowns: i32,
    #[serde(default)]
    pub dragonKills: i32,
    #[serde(default)]
    pub baronKills: i32,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ChallengesDto {
    #[serde(default)]
    pub killParticipation: f32,
}


#[derive(sqlx::FromRow, Debug)]
pub struct DbSummoner {
    pub puuid: String,
    pub gameName: String,
    pub tagLine: String,
    pub region: String,
    pub matchRegionPrefix: Option<String>,
    pub deepLolLink: Option<String>,
    pub tier: String,
    pub rank: Option<String>,
    pub lp: i32,
    pub currentMatchId: Option<String>,
    pub discordChannelId: Option<String>,
    pub regionGroup: Option<String>,
    pub lastUpdated: DateTime<Utc>,
    pub lastMissingDataNotification: DateTime<Utc>,
}

#[derive(sqlx::FromRow, Debug)]
pub struct DbMatchRow {
    pub mid: i64,
    pub matchId: String,
    pub entryPlayerPuuid: String,
    pub gameCreation: i64,
}

#[derive(Serialize, Debug)]
pub struct PlayerStats {
    pub winrate: f32,
    pub games: i32,
    pub streak: i32,
    pub kda: f32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TopChamp {
    pub champion_name: String,
    pub icon_url: String,
    pub games: i32,
    pub wins: i32,
    pub winrate: i32,
    pub kda: f32,
}

#[derive(Serialize, Debug)]
pub struct RankStep {
    pub match_id: String,
    pub label_index: i32,
    pub lp_before: i32,
    pub lp_after: i32,
    pub lp_delta: i32,
    pub result: String,
    pub tier_before: String,
    pub division_before: String,
    pub tier_after: String,
    pub division_after: String,
    pub exact: bool,
}

#[derive(Serialize, Debug)]
pub struct MatchParticipantDetail {
    pub puuid: String,
    pub summoner_name: String,
    pub champion_name: String,
    pub champion_icon_url: String,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub cs: i32,
    pub kda: f32,
    pub role: String,
    pub gold_earned: i32,
    pub gpm: f32,
    pub cs_per_min: f32,
    pub vision_per_min: f32,
    pub items: [i32; 6],
    pub trinket: i32,
    pub damage_dealt: i32,
    pub damage_taken: i32,
    pub vision_score: i32,
    pub kill_participation: f32,
    pub turret_takedowns: i32,
    pub dragon_kills: i32,
    pub baron_kills: i32,
    pub win: bool,
    pub team: String,
}

#[derive(Serialize, Debug)]
pub struct MatchDetails {
    pub match_id: String,
    pub queue_id: i32,
    pub game_creation_ms: i64,
    pub game_duration_s: i64,
    pub participants: Vec<MatchParticipantDetail>,
    pub user_puuid: String,
    pub ddragon_version: String,
}

#[derive(Serialize, Debug)]
pub struct DailyActivityEntry {
    pub date: String,
    pub games: i32,
}

#[derive(Serialize, Debug)]
pub struct PlayerOverview {
    pub profile: PlayerProfile,
    pub matches: Vec<crate::match_summary::MatchSummary>,
    pub stats: PlayerStats,
    pub top_champs: Vec<TopChamp>,
    pub ranked_progress: Vec<RankStep>,
}
