# ASCII City: approved archipelago work

This is the continuation brief for a cloud task in `Evelyn225/emergent-toys`. The user approved the layout and asked to proceed. Continue implementation; the planning and first preservation milestone are already done. Do not restart with another idea list or wait for approval of ordinary implementation steps.

## Goal and approved design

Convert the repeating coastal city into one fixed archipelago. Preserve the existing landmarks, activities, neighborhoods, owned properties, inventory, closet, workshop equipment/upgrades, and saved progress.

- Two main city islands, proposed north/south, separated by a broad central water channel with two raised road bridges. Uneven natural coastlines around each island, beaches, coves, headlands, and working docks. Preserve existing city clusters and their relative geometry; expand natural coast buffers around them instead of deleting blocks to carve a silhouette.
- Retain the airport, marina, fair/pier, aquarium, lighthouse, gardens, Grand Hotel, casino, exchange, museum, club, neighborhood businesses, courier routes, and train stations. Exact coastline positions may change.
- A broad ocean around the archipelago. Eventual wrapping far out at sea is acceptable, but the map itself must never wrap, repeat the city, or hint at the distant seam. Separate finite chart bounds, city generation/storage dimensions, and distant ocean bounds. Keep city/population work close to its current budget; larger ocean must not generate many more city blocks.
- New remote island east/northeast of the city, boat/aircraft access only. Small rough airstrip for actual light-plane takeoff/landing plus boat landing. Mostly natural/scenic: wooded ridge, little waterfall/stream, fishing spots, and a unique purchasable house with an entirely new interior, usable storage/workshop space, and a sea-facing terrace. No road or footbridge to this new island. Its provisional 350–450 m runway length must be tested against the existing prop-plane physics; enlarge if necessary. Aim for roughly a one-to-two-minute speedboat trip, tuning in real play.
- Four or so smaller accessible islands: a cabin cove, rocky fishing outcrop, sand crescent, and wooded islet with one modest house. Sparse distinct scenery, real land/collision, and usable boat landings. No billboard-only islands. Buying these extra small houses is outside the initial scope.

The approved conceptual overhead view is [city/archipelago-layout.html](city/archipelago-layout.html). It is an illustration, not implemented terrain or exact cell positions. The new game map must use actual shared terrain/location data.

## Current implementation checkpoint

The playable world still uses the original coastal layout. Do not claim the two islands, raised bridge geometry, new house, waterfall, remote airstrip, or finite map are implemented yet.

Implemented in this checkpoint:

1. `city/geography.js`: persistent shop/property lot identities and a preservation inventory. The candidate cut y=72 clears 2,770 lots (911 apartment lots), 36 protected groups, 2,360 architecture records, and 120 infrastructure/activity records. Northern/southern groups contain 983/1,787 lots. Run `node tools/city-layout-inventory.cjs` or add `--json` for all bounds, lots, subway/elevated stations, services, piers, vendors, market, grills, and fishing regulars. Geometry beyond those recorded footprints still needs traversal checks.
2. `city/save-format.js` and `save.js`: schema 2 records the explicit current layout `coastal-v1`; old schema-1 saves upgrade with the original bytes retained under `ascii-city-save-backup-v1-coastal-v1`. Home records and map entries use stable place IDs as well as cells. Unknown layout/schema and corrupt saves cannot be overwritten by autosave. Backup storage failure still loads progress, but saving waits for backup creation. This upgrade does NOT yet transform coordinates.
3. Rental boats now remain moored outside the marina, survive save/reload, can be reboarded after hours without another fee, and appear in map search. Returning to the marina ends the hire. Boats have persistent IDs.
4. The previous held-item, workshop/weed/joint/effects, recurring buyer/supplier, and interactive map work is included in the branch snapshot. Preserve it.

Checkpoint verification on Windows: full Node suite 1,011/1,011; focused Chromium geography/map/contacts checks 14/14; focused Firefox geography/save/boat checks 4/4; bundle freshness and duplicate-function checks passed. The inventory was extended to include the 120 infrastructure records after the full suite loaded; its focused logic and bundle checks passed again afterward. A Firefox launch timed out while the full suite was saturating the machine; rerunning after it finished passed all four tests. Recheck on the Linux cloud environment before continuing.

## Next implementation stages

### World coordinates, terrain, and save migration

`N=256` and `NB=32` currently combine content dimensions, array strides, modulo/bitmask wrapping, spatial buckets, and rendering distances. `idx`, `bi`, `rel`, `relB`, road graph edges, and many movement/camera/weather queries assume a torus. Do not simply increase `N` or flip the map flag. Separate these concerns deliberately, and keep a single copy of city content.

Use the inventory to retain whole clusters. A candidate split at y=72 puts the Grand Hotel/Belle/nightlife area north, and gardens/downtown/courier/railway south. Transform all shared geometry and saved world positions explicitly, with versioned, idempotent migration from `coastal-v1`. Retain stable place IDs when relocating. Rebuild the runtime lookup/address tables after moving cells; identity must not be recomputed from a building's new address. Preserve property contents and workshop production. Validate migrated positions and use the appropriate entrance/dock/parking recovery point if invalid; retain recoverable original saves.

Audit coordinates in player street position, home cell/door, parked cars, boats, planes, graffiti, and waypoints. Courier jobs/records use route IDs; room/workshop coordinates are interior-local and must NOT receive outdoor translation. Retain contact history and all economic progress. No island destination may be silently snapped into a walking route to the mainland.

Former seam road links need real ends or authored connections. Elevated rail needs finite terminals or a deliberate closed route, without a train disappearing at one coast and appearing at another. Preserve courier route access and useful geometry. Define shared terrain/shore/height queries for rendering, walking, driving, swimming, boats, aircraft, and the map.

### Raised bridges

Current bridges cross the old north/south seam and their road deck is effectively at ground/water level. `props.js` currently blocks whole bridge bands for ambient boats; `isWater` excludes road cells. Replace this with actual shared 3D bridge decks, ramps, undersides, railings, abutments, and supports. Ground/camera/vehicle elevation follows the grade. Water stays water under spans, supports stay solid, and clearance fits sailboat masts as well as cruisers and ambient craft. A deck overhead must not place someone below it on top of the bridge.

Validate real walking/driving in both directions; sail all boat types under both spans; collide correctly with piers/abutments; check above/below camera views, falls, aircraft contact, and return trips. `elevated.js` and courier geometry show existing shared surface patterns.

### Remote and smaller islands

Build actual natural terrain, waterfall, fishing locations, rough strip, dock, house exterior, and a new room layout. Reuse property/storage/fishing/workshop logic where useful. Keep effects and sound local. Every small island needs a safe landing/reboarding location. Complete normal-control marina→island→marina and airport→strip→airport trips, plus house purchase/save/reload and island exploration. Rental behavior at this checkpoint fixes ashore persistence; also check saving/reloading during travel and recovery cases.

### Fixed map and final checks

`city/navigation.js` already supports bounded rectangular topology in tests; the live `MAP_WORLD` still wraps. Give the actual chart explicit nonwrapping bounds around the full archipelago, update full-map/minimap fit/pan and coast rendering, retain shop search/stock/hours, contacts, properties, and objectives. Label remote access appropriately (boat/air) and route to real departure/arrival points. Check connectivity before endpoint snapping. Direction-only guidance is preferable to claiming an untested safe route over water. No walking shortcut across the ocean or seam.

## Repository and verification instructions

- Sources are classic scripts in `city/`, concatenated in `tools/city-manifest.json` order. Edit sources; rebuild the committed `ascii-city.bundle.js` with `node tools/build-city.cjs` after edits. Do not convert the source system to ES modules.
- Manifest `pure` files must not touch the DOM at load. Node tests use `test/helpers/load-city.cjs`, a `node:vm` loader: top-level lexical globals are accessed through its `ev()` helper.
- Preserve other projects, site routes, shared assets, and unrelated `yomi-mods/`. This branch snapshot is limited to ASCII City and the handoff. Do not merge into `main`, deploy, or publish a release as part of this task. Deliver reviewed changes and test evidence on the cloud task branch.
- No secrets/API keys are required for this game work. Do not copy `openai.env`, local Codex credentials, or unrelated environment files.
- Install dependencies: `npm ci`. Browser tooling: `npx playwright install --with-deps chromium firefox`. Use the repository's pinned Playwright. Configure network access for its required download hosts during setup.
- Node suite: `npm test`. On a constrained machine, run the identical full file set as `node --test --test-concurrency=2 test/*.cjs`. Run appropriate focused logic/browser checks during each stage and the complete node suite before committing city/tools changes.
- Focused current checks: `node --test test/city-geography.test.cjs test/city-boats.test.cjs test/city-navigation.test.cjs test/city-bundle-current.test.cjs`.
- Current browser regressions: `node --test test/browser/city-geography.browser.test.cjs test/browser/city-map.browser.test.cjs test/browser/city-contacts.browser.test.cjs`. Set `CITY_TEST_BROWSER=firefox` for Firefox. Existing workshop, held-item, courier, elevated collision, aircraft, and world tests must remain valid or be deliberately updated for real changed topology.
- Browser fixtures use the real `ascii-city.html`; disable RAF only for deterministic checks and call `env(0)` before `render(0)`. Separately verify real movement/rendering and inspect screenshots. A green build alone is not proof of playable terrain or bridge clearance.
- Tests must cover coordinate migration once only, property identity/contents, coast and bridge agreement, finite routing/rail behavior, boat round trips and reboarding, real prop landing/takeoff, and map agreement. Maintain performance evidence in city, water, and flight views.
- Continue through the remaining stages with meaningful progress updates. The user already approved the design and wants implementation, with reviewable checkpoints. Report actual completion and remaining limits honestly.
