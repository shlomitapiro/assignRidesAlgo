// Load environment variables from .env file into config.js
// This allows for easy configuration without modifying the code.

// Override existing environment variables with values from .env
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

  /**
   * If true, enable fairness penalty in assignment algorithm
   */
  fairnessMode: process.env.FAIRNESS_MODE === 'true',

  /**
   * Penalty weight per already assigned ride
   * Defaults to 1 if not set in .env
   */
  fairnessWeight: parseFloat(process.env.FAIRNESS_WEIGHT) || 1,
};
