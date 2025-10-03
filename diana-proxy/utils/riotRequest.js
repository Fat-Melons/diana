const axios = require("axios");

/**
 * Forward a request to the Riot API with authentication
 * @param {Object} params - Request parameters
 * @param {string} params.base - Base URL (e.g., 'euw1', 'americas')
 * @param {string} params.path - API path (e.g., '/riot/account/v1/accounts/by-puuid/...')
 * @param {Object} params.query - Query parameters object
 * @returns {Promise<any>} - Riot API response data
 */
async function forward({ base, path, query = {} }) {
  if (!process.env.RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY environment variable not set");
  }

  const baseUrl = `https://${base}.api.riotgames.com${path}`;

  const queryString = new URLSearchParams(query).toString();
  const fullUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  try {
    console.log(`[RiotAPI] Forwarding request to: ${fullUrl}`);

    const response = await axios.get(fullUrl, {
      headers: {
        "X-Riot-Token": process.env.RIOT_API_KEY,
        "User-Agent": "Diana-Proxy/1.0.0",
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error(
      `[RiotAPI] Error for ${fullUrl}:`,
      error.response?.status,
      error.response?.data,
    );

    const err = new Error(
      error.response?.data?.message || error.message || "Riot API error",
    );
    err.statusCode = error.response?.status || 500;
    err.response = error.response;

    throw err;
  }
}

/**
 * Forward a request to a non-Riot API (like DDragon) without authentication
 * @param {string} url - Full URL to request
 * @returns {Promise<any>} - API response data
 */
async function forwardExternal(url) {
  try {
    console.log(`[ExternalAPI] Forwarding request to: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Diana-Proxy/1.0.0",
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error(
      `[ExternalAPI] Error for ${url}:`,
      error.response?.status,
      error.response?.data,
    );

    const err = new Error(
      error.response?.data?.message || error.message || "External API error",
    );
    err.statusCode = error.response?.status || 500;
    err.response = error.response;

    throw err;
  }
}

module.exports = {
  forward,
  forwardExternal,
};
