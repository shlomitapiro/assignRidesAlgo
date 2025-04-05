// Entry point for optimized driver-to-ride assignments

require('dotenv').config(); // Load .env into process.env

const fs = require('fs');
const path = require('path');
const { assignOptimizedRides } = require('./optimizer');
const config = require('./config');

// Load drivers and rides data from JSON files
const drivers = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../drivers.json'), 'utf8')
);
const rides = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../rides.json'), 'utf8')
);

console.log('Drivers:', drivers.length);
console.log('Rides:', rides.length);
console.log('Air Distance Filter:', config.useAirDistanceFilter, '(max km:', config.maxAirDistanceKm, ');');
console.log('Optimizing assignments please wait...');

(async () => {
  const optimizedResult = await assignOptimizedRides(drivers, rides, {
    useAirDistanceFilter: config.useAirDistanceFilter,
    maxAirDistanceKm:     config.maxAirDistanceKm,
    getTravelTimeFn:      null
  });

  // Print how many rides were assigned
  const totalRides    = rides.length;
  const assignedCount = optimizedResult.assignments.reduce((sum, a) => sum + a.rideIds.length, 0);
  const pct = ((assignedCount / totalRides) * 100).toFixed(1);
  console.log(`Assigned ${assignedCount} out of ${totalRides} rides (${pct}%)`);

  console.log('Optimized Assignments:');
  console.log(JSON.stringify(optimizedResult, null, 2));
})();