// distanceService.annotated.js
// Calculate travel time and distance, with optional air‑distance filtering

const axios = require('axios');
const config = require('./config');

/**
 * Compute straight‑line (great‑circle) distance between two points.
 * Uses the Haversine formula.
 *
 * @param {[number, number]} coord1 - [latitude, longitude]
 * @param {[number, number]} coord2 - [latitude, longitude]
 * @returns {number} Distance in kilometers
 */
function getAirDistanceKm(coord1, coord2) {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const R = 6371; // Earth radius in km
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

/**
 * Get driving time from A to B via OSRM.
 * 
 * @param {[number, number]} fromCoords - [latitude, longitude]
 * @param {[number, number]} toCoords   - [latitude, longitude]
 * @returns {Promise<number>} Travel time in minutes (rounded up, minimum 1)
 */
async function rawTravelTime(fromCoords, toCoords) {
  // OSRM expects “lon,lat” order in the URL
  const from = `${fromCoords[1]},${fromCoords[0]}`;
  const to   = `${toCoords[1]},${toCoords[0]}`;
  const url  = `http://router.project-osrm.org/route/v1/driving/${from};${to}?overview=false`;

  try {
    const res = await axios.get(url);
    const secs = res.data.routes[0].duration;    // duration in seconds
    const mins = Math.ceil(secs / 60);           // convert to minutes
    return mins < 1 ? 1 : mins;                  // ensure at least 1 minute
  } catch (err) {
    // On network errors or rate limits, treat as unreachable
    console.error('OSRM error:', err.message);
    return Infinity;
  }
}

/**
 * Applies an air-distance filter before calling OSRM.
 * If the straight-line distance exceeds the threshold, returns Infinity immediately.
 *
 * @param {[number, number]} fromCoords
 * @param {[number, number]} toCoords
 * @param {number} maxAirDistanceKm - max allowed air distance in km
 * @returns {Promise<number>} Travel time in minutes or Infinity if filtered
 */
async function filteredTravelTime(fromCoords, toCoords, maxAirDistanceKm) {
  const airDistance = getAirDistanceKm(fromCoords, toCoords);

  // Skip OSRM
  if (airDistance > maxAirDistanceKm) {
    return Infinity;
  }

  // Otherwise, defer to the raw OSRM call
  return rawTravelTime(fromCoords, toCoords);
}

/**
 * Choose between raw or filtered travel time.
 * Controlled by config.useAirDistanceFilter.
 *
 * @param {[number, number]} fromCoords
 * @param {[number, number]} toCoords
 * @returns {Promise<number>} Travel time in minutes
 */
function getTravelTimeInMinutes(fromCoords, toCoords) {
  if (config.useAirDistanceFilter) {
    // Use filtered strategy with configured threshold
    return filteredTravelTime(fromCoords, toCoords, config.maxAirDistanceKm);
  }
  // Default: always call OSRM directly
  return rawTravelTime(fromCoords, toCoords);
}

/**
 * Get driving distance from A to B via OSRM.
 * No filtering applied.
 *
 * @param {[number, number]} fromCoords
 * @param {[number, number]} toCoords
 * @returns {Promise<number>} Distance in kilometers
 */
async function getTravelDistanceInKm(fromCoords, toCoords) {
  const from = `${fromCoords[1]},${fromCoords[0]}`;
  const to   = `${toCoords[1]},${toCoords[0]}`;
  const url  = `http://router.project-osrm.org/route/v1/driving/${from};${to}?overview=false`;

  try {
    const res = await axios.get(url);
    // distance returned in meters; convert to km
    return res.data.routes[0].distance / 1000;
  } catch (err) {
    console.error('OSRM error:', err.message);
    return Infinity;
  }
}

module.exports = {
  getAirDistanceKm,
  rawTravelTime,
  filteredTravelTime,
  getTravelTimeInMinutes,
  getTravelDistanceInKm,
};