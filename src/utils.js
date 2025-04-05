// utils.annotated.js
// Utility functions for time parsing and driver eligibility checks

const { getTravelTimeInMinutes } = require("./distanceService");

/**
 * Converts a time string in HH:mm format to total minutes since midnight.
 * Validates format strictly and throws on invalid input.
 *
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

  // Validate numeric ranges: hours 0-23, minutes 0-59
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
 * Determines if a driver can perform a given ride.
 * Checks status, seat capacity, and whether they can arrive in time
 * from either their home location or the end of their last assigned ride.
 *
 * @param {Object} driver       - Driver object with status, seats, and home coords.
 * @param {Object} ride         - Ride object with startTime and startPoint_coords.
 * @param {Object|null} previousRide - Last assigned ride or null if none.
 * @returns {Promise<boolean>}  - True if driver is eligible, false otherwise.
 */
async function canDriverPerformRide(driver, ride, previousRide = null) {
  if (driver.status !== "active") return false;

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