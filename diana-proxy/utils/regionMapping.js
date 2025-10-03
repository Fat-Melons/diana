// Regional routing for Riot APIs (for account and match services)
const REGIONAL_MAP = {
  americas: "americas",
  europe: "europe",
  asia: "asia",
  sea: "sea",
};

// Platform routing for Riot APIs (for summoner and league services)
const PLATFORM_MAP = {
  na1: "na1",
  br1: "br1",
  la1: "la1",
  la2: "la2",
  euw1: "euw1",
  eun1: "eun1",
  tr1: "tr1",
  ru1: "ru1",
  kr: "kr",
  jp1: "jp1",
  oc1: "oc1",
};

// Map region codes to their regional and platform identifiers
const REGION_TO_BASES = {
  EUW: { platform: "euw1", regional: "europe" },
  EUW1: { platform: "euw1", regional: "europe" },
  EUNE: { platform: "eun1", regional: "europe" },
  EUN1: { platform: "eun1", regional: "europe" },
  NA: { platform: "na1", regional: "americas" },
  NA1: { platform: "na1", regional: "americas" },
  KR: { platform: "kr", regional: "asia" },
  JP: { platform: "jp1", regional: "asia" },
  JP1: { platform: "jp1", regional: "asia" },
  BR: { platform: "br1", regional: "americas" },
  BR1: { platform: "br1", regional: "americas" },
  LAN: { platform: "la1", regional: "americas" },
  LA1: { platform: "la1", regional: "americas" },
  LAS: { platform: "la2", regional: "americas" },
  LA2: { platform: "la2", regional: "americas" },
  OCE: { platform: "oc1", regional: "sea" },
  OC1: { platform: "oc1", regional: "sea" },
  TR: { platform: "tr1", regional: "europe" },
  TR1: { platform: "tr1", regional: "europe" },
  RU: { platform: "ru1", regional: "europe" },
  RU1: { platform: "ru1", regional: "europe" },
};

/**
 * Get the appropriate base URL for a region/platform
 * @param {string} regionOrPlatform - Region code (e.g., 'EUW', 'NA') or direct platform (e.g., 'euw1')
 * @param {string} type - 'regional' or 'platform'
 * @returns {string} - The base URL part (e.g., 'euw1', 'americas')
 */
function getBase(regionOrPlatform, type) {
  const upperRegion = regionOrPlatform.toUpperCase();

  if (REGION_TO_BASES[upperRegion]) {
    return REGION_TO_BASES[upperRegion][type];
  }

  const lowerRegion = regionOrPlatform.toLowerCase();

  if (type === "platform" && PLATFORM_MAP[lowerRegion]) {
    return PLATFORM_MAP[lowerRegion];
  }

  if (type === "regional" && REGIONAL_MAP[lowerRegion]) {
    return REGIONAL_MAP[lowerRegion];
  }

  throw new Error(
    `Unsupported region/platform: ${regionOrPlatform} for type: ${type}`,
  );
}

/**
 * Map a region code to both platform and regional bases
 * @param {string} region - Region code (e.g., 'EUW', 'NA')
 * @returns {Object} - Object with platform and regional properties
 */
function mapRegion(region) {
  const upperRegion = region.toUpperCase();

  if (REGION_TO_BASES[upperRegion]) {
    return REGION_TO_BASES[upperRegion];
  }

  throw new Error(`Unsupported region: ${region}`);
}

module.exports = {
  REGIONAL_MAP,
  PLATFORM_MAP,
  REGION_TO_BASES,
  getBase,
  mapRegion,
};
