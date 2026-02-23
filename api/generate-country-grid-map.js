// This script generates a mapping from grid cell (x,y) to ISO country code using the 'country-reverse-geocoding' npm package.
// Run this with Node.js to produce country-grid-map.json for your project.

const fs = require('fs');
const CountryReverseGeocoding = require('country-reverse-geocoding').country_reverse_geocoding;
const crg = CountryReverseGeocoding();

const GRID_SIZE = 100;
const gridMap = {};

for (let gx = 0; gx < GRID_SIZE; gx++) {
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    // Map grid to lat/lon (equirectangular)
    const lon = -180 + (gx + 0.5) * (360 / GRID_SIZE);
    const lat = 90 - (gy + 0.5) * (180 / GRID_SIZE);
    const country = crg.get_country(lat, lon);
    if (country && country.code) {
      gridMap[`${gx},${gy}`] = country.code;
    } else {
      gridMap[`${gx},${gy}`] = null;
    }
  }
}

fs.writeFileSync('country-grid-map.json', JSON.stringify(gridMap, null, 2));
console.log('country-grid-map.json generated.');
