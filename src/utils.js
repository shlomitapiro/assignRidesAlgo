// utils.annotated.js
// Utility functions: convert time strings and check if a driver can take a ride

const { getTravelTimeInMinutes } = require("./distanceService");

/**
 * Convert a "HH:mm" time string into minutes since midnight.
 * Examples:
 *   "00:00" → 0
 *   "07:30" → 450
 *   "23:59" → 1439
 * @param {string} timeStr - Time string in "HH:mm"
 * @returns {number} Minutes since midnight (0-1439).
 * @throws {Error} If input is not a string or not a valid time.
 */
function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== "string") {
    throw new Error(`Invalid time format: expected string but got ${typeof timeStr}`);
  }

  const [hoursStr, minutesStr] = timeStr.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  // Must be integers: hours 0–23, minutes 0–59
  const isValid =
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 && hours <= 23 &&
    minutes >= 0 && minutes <= 59;

  if (!isValid) {
    throw new Error(`Invalid time string: "${timeStr}". Expected format HH:mm`);
  }

  // Convert to total minutes since midnight
  return hours * 60 + minutes;
}

/**
 * Check if a driver is able to perform a ride:
 * 1. Driver must be active.
 * 2. Must have enough seats.
 * 3. Must be able to arrive before ride start:
 *    - From home, if no previous ride.
 *    - From end of last ride, otherwise.
 *
 * @param {Object}  driver        - { status, numberOfSeats, city_coords }
 * @param {Object}  ride          - { startTime, startPoint_coords, numberOfSeats }
 * @param {Object|null} previousRide - Last assigned ride or null
 * @returns {Promise<boolean>} True if driver can take the ride
 */
async function canDriverPerformRide(driver, ride, previousRide = null) {
  // 1. Must be active
  if (driver.status !== "active") return false;
  // 2. Must have enough seats
  if (driver.numberOfSeats < ride.numberOfSeats) return false;

  // Convert ride start time to minutes since midnight
  const rideStart = parseTimeToMinutes(ride.startTime);

  let travelTime;
  if (previousRide) {
    // If driver has a previous ride, calculate travel time from its end location
    const previousEnd = parseTimeToMinutes(previousRide.endTime);
    travelTime = await getTravelTimeInMinutes(
      previousRide.endPoint_coords,
      ride.startPoint_coords
    );

    // Driver must finish previous ride and travel before new ride starts
    if (previousEnd + travelTime > rideStart) {
      return false;
    }
  } else {
    // No previous ride: calculate travel time from driver's home location
    travelTime = await getTravelTimeInMinutes(
      driver.city_coords,
      ride.startPoint_coords
    );

    // Must arrive from home before ride start
    if (travelTime > rideStart) {
      return false;
    }
  }

  return true;
}

module.exports = {
  parseTimeToMinutes,
  canDriverPerformRide,
};