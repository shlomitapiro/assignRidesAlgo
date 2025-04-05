/**
 * @typedef {Object} Driver
 * @property {string} driverId
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} city
 * @property {string} mainPhone
 * @property {"active"|"inactive"} status
 * @property {string[]} licenceDegree
 * @property {number} numberOfSeats
 * @property {number} fuelCost
 * @property {[number, number]} city_coords
 */

/**
 * @typedef {Object} Ride
 * @property {string} _id
 * @property {string} date // YYYY-MM-DD
 * @property {string} startTime // HH:mm
 * @property {string} endTime // HH:mm
 * @property {string} startPoint
 * @property {string} endPoint
 * @property {number} numberOfSeats
 * @property {[number, number]} startPoint_coords
 * @property {[number, number]} endPoint_coords
 */