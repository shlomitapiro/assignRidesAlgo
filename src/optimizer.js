// optimizer.annotated.js
// Core ride-assignment algorithm with explanatory comments

const { parseTimeToMinutes, canDriverPerformRide } = require("./utils");
const { getTravelTimeInMinutes, getTravelDistanceInKm } = require("./distanceService");
const config = require("./config");

/**
 * Main function: assign rides to drivers in an optimized manner.
 * Minimizes total cost.
 *
 * @param {Array<Object>} drivers - list of driver objects
 * @param {Array<Object>} rides   - list of ride objects
 * @param {Object} options        - runtime options (overrides config)
 * @param {Function} [options.getTravelTimeFn] - optional override for travel-time function
 * @returns {Promise<Object>}     - { assignments, realTotalCost, totalCost }
 */
async function assignOptimizedRides(drivers, rides, options = {}) {
  // Allow overriding the travel-time function; default to the wrapper
  const travelFn = options.getTravelTimeFn || getTravelTimeInMinutes;

  const schedules   = initializeSchedules(drivers);
  const sortedRides = sortRidesByStartTime(rides);

  for (const ride of sortedRides) {
    const { bestDriverId, bestBaseCost } = await findBestDriverForRide(drivers, schedules, ride, travelFn);

    if (bestDriverId) {
      assignRide(schedules, bestDriverId, ride, bestBaseCost);
    }
    // else: no feasible driver, ride remains unassigned
  }

  return buildAssignmentsAndCost(schedules);
}

/**
 * Initialize schedules: prepare an object mapping each driverId to its state
 */
function initializeSchedules(drivers) {
  const schedules = {};
  drivers.forEach(driver => {
    schedules[driver.driverId] = {
      rides: [],       // list of assigned rides
      baseCost: 0,     // sum of all baseCosts
      lastRide: null   // track last assigned ride for time-window checks
    };
  });
  return schedules;
}

/**
 * Sort rides by their start time (HH:mm) ascending
 */
function sortRidesByStartTime(rides) {
  return rides.slice().sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
}

/**
 * Evaluate all drivers for a given ride and pick the one with minimal adjusted cost.
 * Adjusted cost = baseCost (travel+fuel) + fairness penalty.
 */
async function findBestDriverForRide(drivers, schedules, ride, travelFn) {
  
  let bestDriverId = null;
  let bestAdjustedCost = Infinity;
  let bestBaseCost = 0;

  for (const driver of drivers) {
    const sched = schedules[driver.driverId];
    if (!(await canDriverPerformRide(driver, ride, sched.lastRide, travelFn))) continue;
  
    const { baseCost } = await calculateRideCost(driver, ride, sched.lastRide);
    const adjustedCost = baseCost;

    // Choose the driver with the lowest adjusted cost
    if (adjustedCost < bestAdjustedCost) {
      bestAdjustedCost = adjustedCost;
      bestDriverId = driver.driverId;
      bestBaseCost = baseCost;
    }
  }

  return { bestDriverId, bestBaseCost };
}

/**
 * Update the chosen driver's schedule with the new ride and penalty
 */
function assignRide(schedules, driverId, ride, baseCost) {
  const sched = schedules[driverId]; // get driver's schedule
  sched.rides.push(ride);      // append ride
  sched.baseCost += baseCost;  // accumulate base cost
  sched.lastRide = ride;       // update lastRide for next iteration
}

/**
 * After all assignments, compile output structure and compute totals
 */
function buildAssignmentsAndCost(schedules) {
  const assignments = [];
  let realTotalCost = 0;
  
  for (const driverId in schedules) {
    
    const sched = schedules[driverId];
    if (sched.rides.length === 0) continue;
    assignments.push({ driverId, rideIds: sched.rides.map(r => r._id) });
    realTotalCost += sched.baseCost;
  }
  
  return {
    assignments,
    totalCost: Math.round(realTotalCost)
  };
}

/**
 * Compute the base+fuel cost for a single driver-ride assignment
 */
async function calculateRideCost(driver, ride, lastRide) {

  const fromCoords = lastRide ? lastRide.endPoint_coords : driver.city_coords;

  const emptyTime = await getTravelTimeInMinutes(fromCoords, ride.startPoint_coords);

  const emptyDistance = await getTravelDistanceInKm(fromCoords, ride.startPoint_coords);

  const rideTime = parseTimeToMinutes(ride.endTime) - parseTimeToMinutes(ride.startTime);
  
  const timeCost = ((emptyTime + rideTime) / 60) * 30; // Convert to cost (30 NIS per hour)

  const rideDistance = await getTravelDistanceInKm(ride.startPoint_coords, ride.endPoint_coords);
  
  const fuelCost = driver.fuelCost * (emptyDistance + rideDistance);

  return { baseCost: timeCost + fuelCost };
}

module.exports = {
  assignOptimizedRides,
  initializeSchedules,
  sortRidesByStartTime,
  findBestDriverForRide,
  assignRide,
  buildAssignmentsAndCost
};