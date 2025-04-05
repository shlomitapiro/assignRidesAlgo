# Driver Assignment Optimization

This project implements an optimized algorithm to assign rides to drivers, minimizing total cost while optionally enforcing fairness. It supports dynamic configuration for distance filtering and fairness penalties.

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Project Structure](#project-structure)
5. [Configuration](#configuration)
   - [.env File](#env-file)
   - [`src/config.js`](#srcconfigjs)
6. [Data Files](#data-files)
7. [Usage](#usage)
8. [Algorithm Details](#algorithm-details)
   - [1. Initialization](#1-initialization)
   - [2. Sorting Rides](#2-sorting-rides)
   - [3. Cost Calculation](#3-cost-calculation)
   - [4. Fairness Penalty](#4-fairness-penalty)
   - [5. Distance Service Strategies](#5-distance-service-strategies)
9. [Options & Environment Variables](#options--environment-variables)
10. [Running Tests](#running-tests)
11. [Advanced Topics](#advanced-topics)
12. [License](#license)

---

## Overview

`assignOptimizedRides` takes:
- **drivers**: list of driver objects with capacity, location, fuel cost.
- **rides**: list of ride requests with start/end times and coordinates.
- **options**: configuration flags for fairness and distance filtering.

It outputs an assignment of rides to drivers that minimizes:
```
TotalCost = RealBaseCost + TotalPenalty
```

- **RealBaseCost**: time cost (empty travel + ride time) + fuel cost.
- **TotalPenalty**: fairness penalties for uneven ride distribution.

---

## Prerequisites

- Node.js v14+ (tested on v22)
- npm (Node Package Manager)
- Internet access for OSRM API calls (unless distance filtering excludes remote rides)

---

## Installation

```bash
git clone <repo-url>
cd driver-assignment
npm install
```

---

## Project Structure

```
project-root/
├── .env                 # environment variables
├── drivers.json         # sample drivers data
├── rides.json           # sample rides data
├── src/
│   ├── assignRides.js   # entry point
│   ├── optimizer.js     # core algorithm
│   ├── distanceService.js # OSRM & Haversine logic
│   ├── utils.js         # time parsing & eligibility
│   ├── config.js        # loads .env into options
│   └── types.js         # type definitions (optional)
└── README.md            # this document
```

---

## Configuration

### `.env` File
Create a `.env` in the project root:
```dotenv
# Distance filtering
USE_AIR_FILTER=true
MAX_AIR_DISTANCE_KM=10

# Fairness penalty
FAIRNESS_MODE=true
FAIRNESS_WEIGHT=20
```

### `src/config.js`
Loads environment variables (via `dotenv`) and exports:
```js
module.exports = {
  useAirDistanceFilter: process.env.USE_AIR_FILTER === 'true',
  maxAirDistanceKm:     parseFloat(process.env.MAX_AIR_DISTANCE_KM) || 5,
  fairnessMode:         process.env.FAIRNESS_MODE === 'true',
  fairnessWeight:       parseFloat(process.env.FAIRNESS_WEIGHT) || 1,
};
```

These values drive both distance filtering and fairness penalty.

---

## Data Files

- `drivers.json`: array of driver objects:
  ```json
  {
    "driverId": "driver1",
    "city_coords": [lat, lon],
    "numberOfSeats": 4,
    "fuelCost": 2.5,
    ...
  }
  ```

- `rides.json`: array of ride requests:
  ```json
  {
    "_id": "ride1",
    "startTime": "07:00",
    "endTime": "07:20",
    "startPoint_coords": [lat, lon],
    "endPoint_coords": [lat, lon],
    "numberOfSeats": 4
  }
  ```

---

## Usage

1. Ensure `.env` is configured.
2. Run:
   ```bash
   npm start
   ```
3. Output includes:
   - Number of drivers & rides
   - Active modes (fairness, distance filter)
   - JSON of optimized assignments
   - Fairness statistics (min, max, avg, stdDev)

Example:
```bash
Drivers: 4
Rides: 20
Fairness Mode: true (weight: 20)
Air Distance Filter: true (max km: 10)
Optimized Assignments:
{
  "assignments": [...],
  "realTotalCost": 600, ## what we actually paid
  "totalPenalty": 80,
  "totalCost": 680,

  "fairness": { "min":3, "max":5, ... }
}
```

---

## Algorithm Details

### Algorithm Nature and Rationale

This algorithm follows a **greedy, incremental** approach:

- **Greedy Assignment**: Rides are processed in chronological order, and each ride is immediately assigned to the driver with the lowest _adjusted cost_ at that moment. This ensures fast, one-pass execution without backtracking.
- **Local Decision Making**: The choice for each ride is based solely on current schedules and costs, including any fairness penalty. There is no global look‑ahead or re‑optimization of previously assigned rides.
- **Complexity**: With _D_ drivers and _R_ rides, the algorithm performs up to _O(R × D)_ cost evaluations, each involving travel‑time and distance computations. Caching or parallelization can reduce the effective runtime in practice.
- **Trade‑Offs**:
  - *Pros*: Simple to implement, predictable runtime, easy to extend (e.g., add new penalty rules).
  - *Cons*: May not find the absolute global minimum cost under all constraints, especially when fairness penalties or time‑window constraints interact in complex ways.

### When to Use This Approach

- **Medium‑sized fleets** (tens to low hundreds of drivers and rides) where a fast, deterministic assignment is preferred.
- **Dynamic environments** where rides arrive continuously and a full re‑optimization would be too slow.
- **Extensible penalty models**: you can plug in different fairness or priority functions without changing the core loop.

### Limitations & Alternatives

- **No Global Optimality**: For scenarios requiring strict guarantees (e.g., minimize maximum driver load or absolute cost bounds), consider global methods (Hungarian, MILP).
- **Penalty Sensitivity**: The effectiveness of fairness depends on the weight and formula chosen. Large disparities in base costs may require very high penalties or alternative penalty shapes.

## 1. Initialization

### 1. Initialization
- Create an empty schedule for each driver:
  ```js
  schedules = {
    driver1: { rides: [], baseCost:0, penaltyCost:0, lastRide:null },
    ...
  }
  ```

### 2. Sorting Rides
- Sort by `startTime` ascending to assign chronologically.

### 3. Cost Calculation
For each driver and ride:
1. **Empty travel time**: from last ride end (or home) → ride start.
2. **Ride time**: `endTime - startTime`.
3. **Time cost**: `(emptyTime + rideTime)/60 * 30` (30 NIS/hour).
4. **Fuel cost**: `fuelCost * (emptyDistance + rideDistance)`.
5. **baseCost** = timeCost + fuelCost.

### 4. Fairness Penalty
- If `fairnessMode` is `true`, compute penalty:
  ```js
  // Quadratic penalty for next assignment:
  penalty = fairnessWeight * ((currentCount + 1)**2 - 1);
  ```
- **Adjusted cost** = `baseCost + penalty`.
- Choose driver with minimum adjusted cost.

### 5. Distance Service Strategies
In `distanceService.js`:
- **`rawTravelTime`**: always calls OSRM.
- **`filteredTravelTime`**: computes Haversine air distance; if > `maxAirDistanceKm`, returns `Infinity`, else calls OSRM.
- **`getTravelTimeInMinutes`**: wrapper that picks raw or filtered based on `useAirDistanceFilter`.

## Reducing OSRM API Calls
To minimize network overhead and latency, the filtered strategy first calculates the air distance using the fast Haversine formula. Only if the distance is within the configured threshold does it make an HTTP request to the OSRM service. This prevents unnecessary API calls for driver-ride pairs that would be infeasible or too remote, improving performance and reducing external dependencies.

# Disadvantages:
- Under-assignment risk: the air-distance filter may exclude rides that are actually serviceable, reducing the number of assignable rides to drivers.

---

## Options & Environment Variables
| Variable             | Type    | Default | Description                                    |
|----------------------|---------|---------|------------------------------------------------|
| USE_AIR_FILTER       | boolean | true    | Enable air-distance filtering before OSRM call |
| MAX_AIR_DISTANCE_KM  | number  | 5       | Threshold for air-distance filter (km)         |
| FAIRNESS_MODE        | boolean | true    | Enable fairness penalty                       |
| FAIRNESS_WEIGHT      | number  | 1       | Weight of penalty per ride (quadratic formula) |

---

## License
MIT © Shlomi Tapiro