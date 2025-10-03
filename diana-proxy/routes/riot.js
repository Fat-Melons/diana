const express = require("express");
const { forward, forwardExternal } = require("../utils/riotRequest");
const { getBase } = require("../utils/regionMapping");

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /riot/account/v1/accounts/by-riot-id/:name/:tag
router.get(
  "/riot/account/v1/accounts/by-riot-id/:name/:tag",
  asyncHandler(async (req, res) => {
    const { name, tag } = req.params;
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const data = await forward({
        base: regionalBase,
        path: `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /riot/account/v1/accounts/by-puuid/:puuid
router.get(
  "/riot/account/v1/accounts/by-puuid/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const data = await forward({
        base: regionalBase,
        path: `/riot/account/v1/accounts/by-puuid/${puuid}`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /lol/summoner/v4/summoners/by-puuid/:puuid
router.get(
  "/lol/summoner/v4/summoners/by-puuid/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        error: "Missing required query parameter: platform",
        statusCode: 400,
      });
    }

    try {
      const platformBase = getBase(platform, "platform");
      const data = await forward({
        base: platformBase,
        path: `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /lol/league/v4/entries/by-puuid/:puuid
router.get(
  "/lol/league/v4/entries/by-puuid/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        error: "Missing required query parameter: platform",
        statusCode: 400,
      });
    }

    try {
      const platformBase = getBase(platform, "platform");
      const data = await forward({
        base: platformBase,
        path: `/lol/league/v4/entries/by-puuid/${puuid}`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /lol/match/v5/matches/by-puuid/:puuid/ids
router.get(
  "/lol/match/v5/matches/by-puuid/:puuid/ids",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { region, ...otherQuery } = req.query;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const data = await forward({
        base: regionalBase,
        path: `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
        query: otherQuery,
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /lol/match/v5/matches/:matchId
router.get(
  "/lol/match/v5/matches/:matchId",
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const data = await forward({
        base: regionalBase,
        path: `/lol/match/v5/matches/${matchId}`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /lol/match/v5/matches/:matchId/timeline
router.get(
  "/lol/match/v5/matches/:matchId/timeline",
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const data = await forward({
        base: regionalBase,
        path: `/lol/match/v5/matches/${matchId}/timeline`,
        query: {},
      });

      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /ddragon/versions
router.get(
  "/ddragon/versions",
  asyncHandler(async (req, res) => {
    try {
      const data = await forwardExternal(
        "https://ddragon.leagueoflegends.com/api/versions.json",
      );
      res.json(data);
    } catch (error) {
      throw error;
    }
  }),
);

// GET /riot/account/v1/accounts/batch
router.post(
  "/riot/account/v1/accounts/batch",
  asyncHandler(async (req, res) => {
    const { region } = req.query;
    const { puuids } = req.body;

    if (!region) {
      return res.status(400).json({
        error: "Missing required query parameter: region",
        statusCode: 400,
      });
    }

    if (!puuids || !Array.isArray(puuids)) {
      return res.status(400).json({
        error: "Missing or invalid puuids array in request body",
        statusCode: 400,
      });
    }

    try {
      const regionalBase = getBase(region, "regional");
      const results = {};

      for (const puuid of puuids) {
        try {
          const data = await forward({
            base: regionalBase,
            path: `/riot/account/v1/accounts/by-puuid/${puuid}`,
            query: {},
          });

          const displayName = data.tagLine
            ? `${data.gameName}#${data.tagLine}`
            : data.gameName;
          results[puuid] = displayName;

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `Failed to fetch account for PUUID ${puuid}:`,
            error.message,
          );
          const shortId = puuid.length >= 8 ? puuid.substring(0, 8) : puuid;
          results[puuid] = `Player ${shortId}`;
        }
      }

      res.json(results);
    } catch (error) {
      throw error;
    }
  }),
);

module.exports = router;
