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

  numDrivers:   parseInt(process.env.NUM_DRIVERS,  10) || 20,
  numRides:     parseInt(process.env.NUM_RIDES,    10) || 40,
  latMin:       parseFloat(process.env.LAT_MIN)   || 32.30,
  latMax:       parseFloat(process.env.LAT_MAX)   || 32.50,
  lonMin:       parseFloat(process.env.LON_MIN)   || 34.85,
  lonMax:       parseFloat(process.env.LON_MAX)   || 34.95,
};