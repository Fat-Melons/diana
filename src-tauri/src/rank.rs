#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier { IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER }

impl Tier {
    pub fn from_str(s: &str) -> Option<Self> {
        use Tier::*;
        match s.to_ascii_uppercase().as_str() {
            "IRON" => Some(IRON), "BRONZE" => Some(BRONZE), "SILVER" => Some(SILVER),
            "GOLD" => Some(GOLD), "PLATINUM" => Some(PLATINUM), "EMERALD" => Some(EMERALD),
            "DIAMOND" => Some(DIAMOND), "MASTER" => Some(MASTER),
            "GRANDMASTER" => Some(GRANDMASTER), "CHALLENGER" => Some(CHALLENGER),
            _ => None
        }
    }
    pub fn to_str(&self) -> &'static str { use Tier::*; match self {
        IRON=>"IRON", BRONZE=>"BRONZE", SILVER=>"SILVER", GOLD=>"GOLD", PLATINUM=>"PLATINUM",
        EMERALD=>"EMERALD", DIAMOND=>"DIAMOND", MASTER=>"MASTER", GRANDMASTER=>"GRANDMASTER", CHALLENGER=>"CHALLENGER"
    }}
}

pub fn tier_order(t: Tier) -> i32 {
    use Tier::*;
    match t { IRON=>0, BRONZE=>1, SILVER=>2, GOLD=>3, PLATINUM=>4, EMERALD=>5, DIAMOND=>6, MASTER=>7, GRANDMASTER=>8, CHALLENGER=>9 }
}
pub fn next_tier(t: Tier) -> Tier { use Tier::*; match t {
    IRON=>BRONZE, BRONZE=>SILVER, SILVER=>GOLD, GOLD=>PLATINUM, PLATINUM=>EMERALD,
    EMERALD=>DIAMOND, DIAMOND=>MASTER, MASTER=>GRANDMASTER, GRANDMASTER=>CHALLENGER, CHALLENGER=>CHALLENGER
}}
pub fn prev_tier(t: Tier) -> Tier { use Tier::*; match t {
    BRONZE=>IRON, SILVER=>BRONZE, GOLD=>SILVER, PLATINUM=>GOLD, EMERALD=>PLATINUM,
    DIAMOND=>EMERALD, MASTER=>DIAMOND, GRANDMASTER=>MASTER, CHALLENGER=>GRANDMASTER, IRON=>IRON
}}