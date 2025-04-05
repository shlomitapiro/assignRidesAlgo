// Load environment variables from .env file into config.js
require('dotenv').config({ override: true });

module.exports = {
  /**
   * If true, filter by air distance before calling OSRM
   */
  useAirDistanceFilter: process.env.USE_AIR_FILTER === 'true',

  /**
   * Maximum air distance (km) for which to call OSRM
   * Defaults to 5 km if not set in .env
   */
  maxAirDistanceKm: parseFloat(process.env.MAX_AIR_DISTANCE_KM) || 5,
};