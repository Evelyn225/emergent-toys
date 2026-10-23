# ASCII City quality programme

Fix the reported defects first. Then complete the numbered quality passes in order, as small reviewable changes. People and the Cabin Cove prototype are the current visual baseline, not targets for wholesale replacement. New content in the fixes uses the same standard.

## Fixes first

- [x] Aim-aware, unobstructed interaction selection shared by E and its prompt. People and dropped items must remain selectable beside other interactions, including indoors.
- [x] No city traffic, crowd or night bed on islands, including inside the shelter and Fern House.
- [x] World sounds lose volume and high frequencies with distance and pan from their source; fireworks need believable range and propagation delay.
- [x] Shore water advances and recedes across sand; white/pale-blue foam follows the moving edge rather than overlaying transparent stripes on the sea.
- [x] Televisions have an unlit case/bezel and a separate animated screen with recognisable programmes.
- [x] Refit Fern House: attached kitchen units, enclosed bathroom, reachable toilet/bath, coherent partitions, grounded plants and workshop, ceiling-mounted lighting.
- [x] Black lettering on all island information and name signs, smaller boards, readable close/far text. Remove Fern's HOUSE / FALLS sign.
- [x] Match island waymarks to actual visible sights: birds, tide pools, and a physical fire ring at the Fern camp. Keep markers out of access routes.
- [x] Furnish homes: buy/place/rotate/move/store furniture without blocking exits or intersecting walls. Keep existing workshop equipment compatible.
- [x] Individually switchable lamps and a usable record player, with saved state.
- [x] IDEA furniture shop and a plush shark, using proper fitted furniture and product models.
- [x] Framed pictures: an in-game camera/print or local image upload, with bounded local save storage and no external upload requirement.

## Quality bar for each pass

- Shared measurements for connected surfaces, visible geometry and collision; follow [corridor geometry notes](corridor-geometry-notes.md).
- Rounded profiles where appropriate, real thickness, supported fixtures, clean joins, usable clearance and correct orientation. Texture cannot substitute for silhouette.
- Calm materials with filtered small detail; smooth changes with distance, readable signs without repeated letters, and no flickering overlaps.
- Features have visible, audible and persistent results. E prompts describe the actual selected target.
- Review close/wide and oblique browser views, day/night and relevant weather; walk access routes and use real controls.
- Keep terrain/building caches, culling and render cost under review. Measure representative scenes before adopting broadly.

## Subsequent passes

Each unchecked row is a chunk, with its own verification and screenshots. The list covers the whole game, rather than only islands.

1. [ ] Shared furniture: chairs, stools, benches, sofas, beds, tables, shelves, cabinets, wardrobes and counters; unified fitted construction and seating.
2. [ ] Bathrooms: toilets, baths, showers, sinks, mirrors, taps, plumbing, partitions, doors and useful layouts.
3. [ ] Kitchens and dining: cupboards, worktops, appliances, cookware, dishes, food displays, seating and cooking feedback.
4. [ ] Home lighting, electronics and decoration: lamps, switches, TVs, record players, radios, clocks, books, plants, frames and keepsakes.
5. [ ] Standard apartments, lofts and Belle homes: distinct layouts, finished openings, balconies, windows and coherent furnishing sets.
6. [ ] Hotels and motels: rooms, suites, lobbies, reception, bathrooms, service areas and price-appropriate character.
7. [ ] Shop interiors: grocer, deli, hardware, sports, toys, thrift, records, tattoo, florist, pet shop, pharmacy, pawn, jeweller and remaining specialist stores.
8. [ ] Restaurants, cafés and bars: ramen/noodles, diners, regional restaurants, bakery, tea, coffee, karaoke and nightlife.
9. [ ] Civic interiors: hospital, bank, jail, gym, laundry, storage, museum and apartment lobbies.
10. [ ] Leisure interiors: arcade, casino, cinema, club, aquarium, conservatory, aviary and cathedral.
11. [ ] Everyday street objects: bins, hydrants, benches, mailboxes, bollards, drains, grates, utility cabinets, bus shelters and vending machines.
12. [ ] Street lights and utilities: poles, signals, lamps, overhead cables, pipes, meters and service access.
13. [ ] Signs and shopfronts: typography, physical mounts, fascia, windows, shutters, awnings, doors and displays across every district.
14. [ ] Market streets and Shotengai: roofs, supports, lanterns, stalls, baskets, bicycles and connected frontage details.
15. [ ] Building architecture: roofs, masonry, cornices, balconies, stairs, fire escapes, chimneys, rooftop equipment and facade variation.
16. [ ] Roads and ground: kerbs, pavement, crossings, junctions, road markings, patching, slopes, walls, fences and retaining edges.
17. [ ] Bridges: decks, joints, towers, supports, cables, railings, approaches, lighting and snow/water integration.
18. [ ] Parks and vegetation: trees, shrubs, flowers, planters, grass, paths, ponds, picnic props and seasonal material transitions.
19. [ ] Coast and islands: rock, sand, tidal pools, driftwood, camps, skiffs, piers, shelters, landings and water/land joins. Preserve Cabin Cove's completed work.
20. [ ] Water and weather: ocean, inland water, wakes, spray, rain, snow, puddles, shore foam, reflections and waterfall continuity.
21. [ ] Cars and road services: vehicle bodies, cabins, wheels, lamps, glass, dashboards, taxis, emergency vehicles, traffic damage and fuel equipment.
22. [ ] Elevated railway and subway: carriages, seats, doors, poles, bogies, platforms, stairs, rails, supports and station displays.
23. [ ] Ferries and boats: hulls, deck joins, seating, cabin fixtures, railings, boarding, terminals, food counters and visible navigation hardware.
24. [ ] Airport and aircraft: fuselages, cockpits, interiors, wheels, rotors, wings, terminals, hangars, runway furniture and boarding.
25. [ ] Fairground and industrial landmarks: rides, booths, cranes, gantries, warehouses, smokestacks and working moving assemblies.
26. [ ] Landmark exteriors: lighthouse, cathedral, towers, museum, conservatory, aquarium and grand hotels.
27. [ ] Inventory and held objects: food portions/bites, drinks, tools, weapons, fishing gear, curios, electronics and dropped/displayed models.
28. [ ] Wildlife, pets and fish: readable shaped species, habitat, movement and proximity detail; preserve existing people.
29. [ ] Activity feedback: fishing, cooking, workshops, sports, skating, crime, damage, smoke, fire and fireworks.
30. [ ] Soundscape throughout: location-specific ambience, distance, occlusion, indoor transitions, machines, music and activity feedback.
31. [ ] Presentation and controls: inventory/shop previews, map, placement controls, interaction prompts, touch accessibility and scaling.
32. [ ] Final integration tour: all districts, all interiors, every island and vehicle; saves, interactions, seasonal scenes and measured city/coast/interior performance.

## Checkpoint

The reported-fix batch is implemented and reviewed in Chromium, including shoreline wash/backwash, Fern kitchen/bathroom/living room, IDEA, placed furniture, night lighting, and the 390px phone menu. Regression coverage includes actual E/Q/F controls, photograph save/reload, packed lamp state, workshop refresh, legacy save migration, reachable island sights, and shared tide-pool collision heights.

At home, F opens furnishings; Q unpacks a held purchase, Q rotates during placement, E places, and Esc cancels. Lamps and frames use aimed E. The compact camera captures the view with Q; the album holds eight local photographs. Each home supports 48 movable furnishings. Plush sharks can go on the floor or supported tables. IDEA occupies one existing open hardware-store location and is searchable by name.

The numbered passes above remain the work queue. The new models establish reusable rounded geometry and filtered materials, but no broad category is marked complete merely because these foundations exist.


## Completed chunks

- Reported fixes and home furnishing foundation: [PR #135](https://github.com/Evelyn225/emergent-toys/pull/135). Botanical-garden birds replace city beds on islands; new home furniture, photos, lamps and records are usable and persistent.
- Shared furniture, first chunk: dining chairs, four-leg tables and upholstered sofas now have rounded solids, connected rails/legs, separate cushions and filtered materials. The shared helpers reach existing apartments, hotels, cafés and other callers. Standard home sofas now use the shared builder. Reviewed front, back, oblique and studio views; existing seating and hotel controls are covered by browser regressions. Beds, shelves, wardrobes, counters, stools and benches remain in pass 1.
- Interaction follow-up: line of sight derives eye height from the current player state, so a room entered before the next render uses indoor metres immediately. Grand Hotel check-in exercises that transition.

- Interaction integration checks: transparent counter grilles preserve sight; seated head height and jail cab-driver conversations remain selectable; the VIP host keeps the service action; ceiling lamps require a deliberate aim. Shop reachability checks now choose a visible counter approach. Casino staking tests isolate games from patrons and aim at equipment, while person selection has separate coverage. Camera and flatpack art use visible glyphs, including at the hand grip.
- Indoor audio uses the building's actual outdoor location for both nature ambience and sirens. Real Web Audio checks confirm mainland sirens stay silent in an island interior, nearby sources play, moving inside does not change the outdoor source location, and changing buildings clears distant voices.
- Activity feedback (pass 29), fireworks sound: the show stopped launching whenever you were in a room, so Saturday night in a waterfront bar was silent. Shells now keep going indoors and their bursts arrive muffled through the walls via the shared distance profile. Each launch also has a mortar thump from the barge, delayed, panned and dulled with distance like the burst. Chromium: outdoor thump/boom delays, indoor show continues at under 30% gain with ≤900 Hz cutoff; existing calendar and two-hour show checks pass (21 checks). Node 1058/1058. Firework smoke belongs to the smoke chunk.
- Activity feedback (pass 29), fire: Fern's camp fire was never added to `FIRES` (filtered once at load, before the islands are built), so it had no flames or firelight while E offered "cook over the campfire" at a cold ring. It now registers like the coast camps, keeps island-sights' stone ring and logs (no duplicate stones), and burns at night. Night-only camp fires also light whenever you cook over them, by day too (`fireLit`). Lit campfires crackle and snap, and burning cars crackle faster and louder, from where they are through the shared distance profile, muffled indoors. Chromium: lit/cold/cooking states, crackle position, indoor muffling and car vs campfire, plus cooking, island sights, coast home and audio suites (23 checks); night before/after and oblique views inspected (`tmp/fire-fern-*.png`). Node 1058/1058.
- Activity feedback (pass 29), smoke: lit campfires now trail smoke, and Fern House's chimney smokes after dark (the "light evening smoke" the handoff describes had no emitter in the source). Each firework burst leaves a slow cloud hanging where it burst, faint against the night and lit in the colour of the latest burst; at most 24 at once, oldest first. World smoke is emitted only within view distance and never indoors, under the shared 140-puff haze cap. Chromium: cold by day, rising off the lit fire and out of the chimney top after dark, none made indoors, firework cloud cap/order/lighting; existing smoke, calendar, fireworks, fire and cooking checks (13). Views inspected: chimney at dusk, fireworks before/after and at a burst (`tmp/smoke-*.png`). Node 1058/1058.
- Activity feedback (pass 29), damage: a round that struck a wall, the ground or a car showed a 0.09 s spark and nothing else, and "*PANG* off the car" made no sound. Impacts now sound where they land (a clank off a car, a chip and grit off a wall, a thud into the ground), through the shared distance profile outdoors and at room scale indoors. Shots into a building's wall outdoors leave a hole on the exact face the shot crossed (from the cell boundary), drawn only from that side and depth-tested; the last 60 stay for the session. Indoor wall holes are not in this chunk. Chromium: real `pullTrigger` into a wall and a parked car (face, normal, drawn glyph, chip, clank, car damage) plus gun, gun-control and audio suites (16). Close and oblique views inspected (`tmp/damage-holes-*.png`). Node 1058/1058.
- Activity feedback (pass 29), crime: `gun.js` already had an unattended car's alarm calling in gunfire, but no car had an alarm. A car left parked with nobody in it (not a police car) that is shot or knocked now goes off for 20 seconds: a synthesised warble/whoop/beep cycle from where it stands through the shared distance profile, and its head and tail lights flashing together. Hitting it again restarts it; getting in turns it off and clears it; frozen frames hush it with the sirens. Node: alarm rule (parked/driven/police/occupied, expiry, restart). Chromium: a real shot sets one positioned voice that expires, restarts and stops on entry; 30 car, gun, crime and audio checks. Night flash on/off inspected (`tmp/crime-alarm-*.png`). Node 1059/1059.
