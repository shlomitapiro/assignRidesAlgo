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

// Controlled via config.js
console.log('Fairness Mode:', config.fairnessMode, '(weight:', config.fairnessWeight, ');');
console.log('Air Distance Filter:', config.useAirDistanceFilter, '(max km:', config.maxAirDistanceKm, ');');

(async () => {
    const optimizedResult = await assignOptimizedRides(drivers, rides, {
      fairnessMode:   config.fairnessMode,
      fairnessWeight: config.fairnessWeight,
      useAirDistanceFilter: config.useAirDistanceFilter,
      maxAirDistanceKm: config.maxAirDistanceKm,
    });
  
    console.log('Optimized Assignments:');
    // Stringify and insert an extra blank line before the "fairness" section
    let resultStr = JSON.stringify(optimizedResult, null, 2);
    resultStr = resultStr.replace(/("totalCost":\s*\d+,)\n(\s*"fairness")/, '$1\n\n$2');
    console.log(resultStr);
})();
