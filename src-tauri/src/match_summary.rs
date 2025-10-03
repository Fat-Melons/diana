use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct MatchSummary {
    #[serde(default)]
    pub match_id: String,
    #[serde(default)]
    pub queue_id: i32,
    #[serde(default)]
    pub game_creation_ms: i64,
    #[serde(default)]
    pub game_duration_s: i64,
    #[serde(default)]
    pub win: bool,
    #[serde(default)]
    pub champion_name: String,
    #[serde(default)]
    pub champion_icon_url: String,
    #[serde(default)]
    pub kills: i32,
    #[serde(default)]
    pub deaths: i32,
    #[serde(default)]
    pub assists: i32,
    #[serde(default)]
    pub cs: i32,
    #[serde(default)]
    pub kda: f32,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub gold_earned: i32,
    #[serde(default)]
    pub gpm: f32,
    #[serde(default)]
    pub cs_per_min: f32,
    #[serde(default)]
    pub vision_per_min: f32,
    #[serde(default)]
    pub items: [i32; 6],
    #[serde(default)]
    pub trinket: i32,
    #[serde(default)]
    pub damage_dealt: i32,
    #[serde(default)]
    pub damage_taken: i32,
    #[serde(default)]
    pub vision_score: i32,
    #[serde(default)]
    pub kill_participation: f32,
    #[serde(default)]
    pub turret_takedowns: i32,
    #[serde(default)]
    pub dragon_kills: i32,
    #[serde(default)]
    pub baron_kills: i32,
    #[serde(default)]
    pub ddragon_version: String,
}

