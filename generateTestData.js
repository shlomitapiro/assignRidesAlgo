#!/usr/bin/env node
// generateTestData.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require("./src/config.js");

const OSRM_BASE   = 'http://router.project-osrm.org';
const NUM_DRIVERS = config.numDrivers; 
const NUM_RIDES   = config.numRides;

// Geographical bounds for random lat/lon generation
const LAT_MIN = config.latMin;
const LAT_MAX = config.latMax;
const LON_MIN = config.lonMin;
const LON_MAX = config.lonMax;

// Helpers
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}
function pad(n) {
  return n.toString().padStart(2, '0');
}
/**
 * Generate a random start time between 06:00 and 18:00,
 * then an end time by adding 10–60 minutes.
 */
function randomTimeWindow() {
  const startHour   = Math.floor(randomInRange(6, 18));
  const startMinute = Math.floor(randomInRange(0, 60));
  const durationMin = Math.floor(randomInRange(10, 60));
  let totalStart    = startHour * 60 + startMinute;
  let totalEnd      = totalStart + durationMin;
  // wrap past midnight (unlikely here, but safe)
  totalEnd = totalEnd % (24 * 60);

  const sh = Math.floor(totalStart / 60), sm = totalStart % 60;
  const eh = Math.floor(totalEnd   / 60), em = totalEnd   % 60;
  return {
    startTime: `${pad(sh)}:${pad(sm)}`,
    endTime:   `${pad(eh)}:${pad(em)}`
  };
}

/**
 * Snap a [lat,lon] point to the nearest road via OSRM nearest service.
 * Falls back to the original point on error.
 */
async function snapToRoad([lat, lon]) {
  try {
    const url = `${OSRM_BASE}/nearest/v1/driving/${lon},${lat}?number=1`;
    const res = await axios.get(url);
    const [snappedLon, snappedLat] = res.data.waypoints[0].location;
    return [snappedLat, snappedLon];
  } catch (err) {
    console.warn('OSRM nearest failed, using raw coords:', err.message);
    return [lat, lon];
  }
}

async function generate() {
  // 1. Generate drivers.json
  const drivers = [];
  for (let i = 1; i <= NUM_DRIVERS; i++) {
    const rawCoord = [
      randomInRange(LAT_MIN, LAT_MAX),
      randomInRange(LON_MIN, LON_MAX)
    ];
    const city_coords = await snapToRoad(rawCoord);

    drivers.push({
      driverId:       `driver${i}`,
      firstName:      `First${i}`,
      lastName:       `Last${i}`,
      city:           `City${i}`,
      mainPhone:      `050${String(1000000 + i).slice(1)}`,
      status:         'active',
      licenceDegree:  ['B'],
      numberOfSeats:  [4, 19, 50][Math.floor(Math.random()*3)],
      fuelCost:       Number((randomInRange(1.5, 3.0)).toFixed(2)),
      city_coords
    });
  }
  fs.writeFileSync(
    path.join(__dirname, 'drivers.json'),
    JSON.stringify(drivers, null, 2)
  );
  console.log(`→ Wrote drivers.json with ${NUM_DRIVERS} drivers`);

  // 2. Generate rides.json
  const rides = [];
  for (let i = 1; i <= NUM_RIDES; i++) {
    const { startTime, endTime } = randomTimeWindow();

    const rawStart = [
      randomInRange(LAT_MIN, LAT_MAX),
      randomInRange(LON_MIN, LON_MAX)
    ];
    const rawEnd = [
      randomInRange(LAT_MIN, LAT_MAX),
      randomInRange(LON_MIN, LON_MAX)
    ];
    const startPoint_coords = await snapToRoad(rawStart);
    const endPoint_coords   = await snapToRoad(rawEnd);

    rides.push({
      _id:                `ride${i}`,
      date:               new Date().toISOString().slice(0,10), // today’s date
      startTime,
      endTime,
      startPoint:         `Point${i}-A`,
      endPoint:           `Point${i}-B`,
      numberOfSeats:      [4, 14, 19, 50][Math.floor(Math.random()*4)],
      startPoint_coords,
      endPoint_coords
    });
  }
  fs.writeFileSync(
    path.join(__dirname, 'rides.json'),
    JSON.stringify(rides, null, 2)
  );
  console.log(`→ Wrote rides.json with ${NUM_RIDES} rides`);
}

generate().catch(err => {
  console.error('Failed to generate test data:', err);
  process.exit(1);
});
