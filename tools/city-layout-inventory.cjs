'use strict';
// Run with --json for the complete preservation manifest, otherwise print the audit summary.
const { loadCity } = require('../test/helpers/load-city.cjs');
const { ev } = loadCity();
const inventory = JSON.parse(ev('JSON.stringify(cityLayoutInventory())'));
if (process.argv.includes('--json')) console.log(JSON.stringify(inventory, null, 2));
else {
  console.log(`Layout: ${inventory.layout}; candidate split: y=${inventory.splitY}`);
  console.log(JSON.stringify(inventory.counts, null, 2));
  console.log(`Footprints crossing cut: ${inventory.conflicts.length}`);
  for (const conflict of inventory.conflicts) console.log(`  ${conflict.id}: ${conflict.name} (${conflict.y0}..${conflict.y1})`);
  for (const island of ['north', 'south']) {
    console.log(`${island}: ${inventory.places.filter(place => place.island === island).length} lots`);
    console.log(inventory.fixed.filter(place => place.island === island).map(place => `  ${place.id}: ${place.name}`).join('\n'));
  }
}
if (inventory.conflicts.length) process.exitCode = 1;
