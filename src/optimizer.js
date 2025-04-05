// optimizer.annotated.js
// Core ride-assignment algorithm with explanatory comments

const { parseTimeToMinutes, canDriverPerformRide } = require("./utils");
const { getTravelTimeInMinutes, getTravelDistanceInKm } = require("./distanceService");
const config = require("./config");

/**
 * Main function: assign rides to drivers in an optimized manner.
 * Minimizes total cost and optionally applies a fairness penalty.
 *
 * @param {Array<Object>} drivers - list of driver objects
 * @param {Array<Object>} rides   - list of ride objects
 * @param {Object} options        - runtime options (overrides config)
 * @returns {Promise<Object>}     - assignments, cost breakdown, fairness stats
 */
async function assignOptimizedRides(drivers, rides, options = {}) {
  // Destructure options with fallbacks to global config values
  const {
    fairnessMode         = config.fairnessMode,         // enable fairness penalty?
    fairnessWeight       = config.fairnessWeight,       // penalty weight
    useAirDistanceFilter = config.useAirDistanceFilter, // filter distant rides?
    maxAirDistanceKm     = config.maxAirDistanceKm,     // threshold in km
    getTravelTimeFn      = null                          // override travel-time function
  } = options;

  // Determine which travel-time function to use:
  //  - if provided via options, use that
  //  - else if air-distance filtering is enabled, wrap filteredTravelTime
  //  - else use raw OSRM-based travel time

  // Determine which travel-time function to use:
  // - if provided via options, use that
  // - else use the getTravelTimeInMinutes wrapper (handles raw vs filtered based on config)

  // You could also bypass the wrapper and choose directly:
  // const travelFn = getTravelTimeFn || (useAirDistanceFilter ? filteredTravelTime : rawTravelTime);
  const travelFn = getTravelTimeFn || getTravelTimeInMinutes;

  // Initialize an empty schedule for each driver
  const schedules = initializeSchedules(drivers);
  const sortedRides = sortRidesByStartTime(rides);

  for (const ride of sortedRides) {
    // Find the best driver based on adjusted cost (baseCost + penalty)
    const { bestDriverId, bestBaseCost } = await findBestDriverForRide(drivers, schedules, ride,
      { fairnessMode, fairnessWeight, getTravelTimeFn: travelFn }
    );

    // If a feasible driver was found, update their schedule
    if (bestDriverId) {
      assignRide(schedules, bestDriverId, ride, bestBaseCost, { fairnessMode, fairnessWeight });
    }
    // else: ride remains unassigned (e.g., no driver available for now)
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
      penaltyCost: 0,  // sum of all penalties
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
async function findBestDriverForRide(drivers, schedules, ride, options) {
  const { fairnessMode, fairnessWeight, getTravelTimeFn } = options;
  let bestDriverId = null;
  let bestAdjustedCost = Infinity;
  let bestBaseCost = 0;

  for (const driver of drivers) {
    const sched = schedules[driver.driverId];
    // Check if driver can physically perform this ride (seats, time window)
    if (!(await canDriverPerformRide(driver, ride, sched.lastRide, getTravelTimeFn))) {
      continue; // skip drivers who are not feasible
    }

    const { baseCost } = await calculateRideCost(driver, ride, sched.lastRide);

    const penalty = fairnessMode ? computePenalty(sched.rides.length, fairnessWeight) : 0;
    const adjustedCost = baseCost + penalty;

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
function assignRide(schedules, driverId, ride, baseCost, options) {
  const { fairnessMode, fairnessWeight } = options;
  const sched = schedules[driverId];

  // Penalty computed before adding ride to reflect next-assignment cost
  const penalty = fairnessMode ? computePenalty(sched.rides.length, fairnessWeight) : 0;

  sched.rides.push(ride);      // append ride
  sched.baseCost += baseCost;  // accumulate base cost
  sched.penaltyCost += penalty;// accumulate penalty cost
  sched.lastRide = ride;       // update lastRide for next iteration
}

/**
 * After all assignments, compile output structure and compute totals
 */
function buildAssignmentsAndCost(schedules) {
  const assignments = [];
  let realTotalCost = 0;
  let totalPenalty = 0;

  for (const driverId in schedules) {
    const sched = schedules[driverId];
    if (sched.rides.length === 0) continue;

    // Collect ride IDs for output
    assignments.push({
      driverId,
      rideIds: sched.rides.map(r => r._id)
    });

    realTotalCost += sched.baseCost;
    totalPenalty += sched.penaltyCost;
  }

  const totalCost = realTotalCost + totalPenalty;

  const fairness = computeFairnessStats(schedules);

  return {
    assignments,
    realTotalCost: Math.round(realTotalCost),
    totalPenalty: Math.round(totalPenalty),
    totalCost: Math.round(totalCost),
    fairness
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

/**
 * Compute distribution stats for fairness analysis
 */
function computeFairnessStats(schedules) {
  const counts = Object.values(schedules).map(s => s.rides.length);
  const total = counts.reduce((sum, c) => sum + c, 0);
  const n = counts.length;
  const avg = total / n;
  const variance = counts.reduce(
    (sum, c) => sum + (c - avg) ** 2,
    0
  ) / n;
  const stdDev = Math.sqrt(variance);

  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    avg: Number(avg.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    countsPerDriver: Object.entries(schedules).map(
      ([driverId, s]) => ({ driverId, count: s.rides.length })
    )
  };
}

/**
 * Quadratic fairness penalty: (currentCount+1)^2 - 1, scaled by weight
 */
function computePenalty(currentCount, fairnessWeight) {
  return fairnessWeight * ((currentCount + 1) ** 2 - 1);
}

module.exports = {
  assignOptimizedRides,
  initializeSchedules,
  sortRidesByStartTime,
  findBestDriverForRide,
  assignRide,
  buildAssignmentsAndCost
};
